"""Freeze a generated suite, then instrument a copy of it for evaluation.

Two directories come out of this module:

``frozen/``       Byte-exact copy of the agent's generated specs plus a manifest
                  of SHA-256 hashes. Never modified again. Every run is verified
                  against these hashes so a drifted suite cannot be reported as
                  the frozen one.

``instrumented/`` Copy of ``frozen/`` whose ``@playwright/test`` imports are
                  redirected to the evaluation fixture. Built once and reused
                  identically for the clean runs and every bug run, so the
                  rewrite cannot bias one arm relative to another.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
FIXTURE_SOURCE = ASSETS_DIR / "wtp_fixture.ts"
CONFIG_SOURCE = ASSETS_DIR / "wtp.config.ts"
FIXTURE_BASENAME = "__wtp_fixture"
# Instrumented specs live inside the generated project so Node can resolve
# `@playwright/test` from the project's own node_modules.
INSTRUMENTED_DIR_NAME = "__wtp_eval"

SPEC_SUFFIXES = (".spec.ts", ".spec.js", ".spec.tsx", ".spec.jsx", ".test.ts", ".test.js")
# Directory names the agent is told to write generated specs into.
GENERATED_DIR_NAMES = ("rq6-agent", "rq6-graph-agent", "rq6-feature-agent")
# Playwright's own agents write into `tests/`, alongside the seed test that bootstraps them.
PLAYWRIGHT_AGENTS_DIR_NAMES = ("tests",)
# Files inside a generated directory that are setup rather than generated coverage. A seed
# test exists only to give the planner a ready `page`; freezing it would inflate the suite
# and let a trivially-passing test into the clean-stability denominator.
NON_GENERATED_SPEC_NAMES = frozenset({"seed.spec.ts", "seed.spec.js"})


class FreezeError(RuntimeError):
    pass


@dataclass
class FrozenSuite:
    root: Path
    source: Path
    files: dict[str, str] = field(default_factory=dict)  # relative path -> sha256

    @property
    def spec_count(self) -> int:
        return sum(1 for name in self.files if name.endswith(SPEC_SUFFIXES))

    def to_dict(self) -> dict[str, object]:
        return {
            "root": str(self.root),
            "source": str(self.source),
            "file_count": len(self.files),
            "spec_count": self.spec_count,
            "files": self.files,
        }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def find_generated_dir(
    workspace: Path, dir_names: tuple[str, ...] | None = None
) -> Path:
    """Locate the agent-generated spec directory inside a finished workspace."""
    candidates: list[Path] = []
    for name in dir_names or GENERATED_DIR_NAMES:
        candidates.extend(
            path
            for path in workspace.rglob(name)
            if path.is_dir() and "node_modules" not in path.parts
        )
    if not candidates:
        raise FreezeError(
            f"no generated test directory ({', '.join(GENERATED_DIR_NAMES)}) found under {workspace}"
        )
    with_specs = [
        path
        for path in candidates
        if any(
            child.name.endswith(SPEC_SUFFIXES)
            and child.name not in NON_GENERATED_SPEC_NAMES
            for child in path.rglob("*")
        )
    ]
    if not with_specs:
        raise FreezeError(
            f"generated test directory found under {workspace} but it contains no spec files: "
            f"{[str(p) for p in candidates]}"
        )
    if len(with_specs) > 1:
        raise FreezeError(
            "multiple generated test directories contain specs; refusing to guess: "
            f"{[str(p) for p in with_specs]}"
        )
    return with_specs[0]


def freeze_suite(generated_dir: Path, destination: Path) -> FrozenSuite:
    """Copy the generated specs to an immutable, hashed location."""
    if destination.exists():
        raise FreezeError(f"freeze destination already exists: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        generated_dir,
        destination,
        ignore=shutil.ignore_patterns(
            "node_modules", "test-results", "playwright-report", "*.bak",
            *NON_GENERATED_SPEC_NAMES,
        ),
    )

    suite = FrozenSuite(root=destination, source=generated_dir)
    for path in sorted(destination.rglob("*")):
        if path.is_file():
            suite.files[path.relative_to(destination).as_posix()] = sha256_file(path)
    if suite.spec_count == 0:
        raise FreezeError(f"frozen suite at {destination} contains no spec files")

    (destination.parent / "frozen_manifest.json").write_text(
        json.dumps(suite.to_dict(), indent=2) + "\n", "utf-8"
    )
    return suite


def verify_frozen(suite: FrozenSuite) -> list[str]:
    """Re-hash the frozen suite; any difference is reported, never repaired."""
    problems: list[str] = []
    seen: set[str] = set()
    for path in sorted(suite.root.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(suite.root).as_posix()
        seen.add(relative)
        expected = suite.files.get(relative)
        if expected is None:
            problems.append(f"unexpected file appeared in frozen suite: {relative}")
        elif sha256_file(path) != expected:
            problems.append(f"frozen file modified: {relative}")
    for relative in suite.files:
        if relative not in seen:
            problems.append(f"frozen file missing: {relative}")
    return problems


# `import ... from '@playwright/test'` / `require('@playwright/test')`
_IMPORT_RE = re.compile(r"""(['"])@playwright/test\1""")


@dataclass
class Instrumentation:
    root: Path
    config: Path
    rewritten: dict[str, int] = field(default_factory=dict)
    untouched: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "root": str(self.root),
            "config": str(self.config),
            "rewritten_files": self.rewritten,
            "rewrite_total": sum(self.rewritten.values()),
            "untouched_files": self.untouched,
        }


def instrument_suite(suite: FrozenSuite, destination: Path) -> Instrumentation:
    """Copy the frozen suite and redirect its Playwright imports to the fixture.

    Purely mechanical: only the module specifier ``@playwright/test`` changes, and
    the fixture re-exports everything from the real module, so test semantics are
    untouched. The same instrumented tree serves the clean and buggy arms.
    """
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(suite.root, destination)

    fixture_target = destination / f"{FIXTURE_BASENAME}.ts"
    shutil.copyfile(FIXTURE_SOURCE, fixture_target)
    config_target = destination.parent / "wtp.config.ts"
    shutil.copyfile(CONFIG_SOURCE, config_target)

    result = Instrumentation(root=destination, config=config_target)

    for path in sorted(destination.rglob("*")):
        if not path.is_file() or path == fixture_target:
            continue
        if path.suffix.lower() not in {".ts", ".js", ".tsx", ".jsx", ".mjs", ".cjs"}:
            continue
        original = path.read_text("utf-8")
        if "@playwright/test" not in original:
            result.untouched.append(path.relative_to(destination).as_posix())
            continue

        # Relative specifier from this file to the fixture at the tree root.
        depth = len(path.relative_to(destination).parts) - 1
        prefix = "./" if depth == 0 else "../" * depth
        specifier = f"{prefix}{FIXTURE_BASENAME}"
        updated, count = _IMPORT_RE.subn(
            lambda match: f"{match.group(1)}{specifier}{match.group(1)}", original
        )
        if count:
            path.write_text(updated, "utf-8")
            result.rewritten[path.relative_to(destination).as_posix()] = count

    if not result.rewritten:
        raise FreezeError(
            "instrumentation rewrote no imports; the frozen specs do not import "
            "'@playwright/test', so bug injection would silently not apply"
        )

    metadata_dir = suite.root.parent
    (metadata_dir / "instrumentation.json").write_text(
        json.dumps(result.to_dict(), indent=2) + "\n", "utf-8"
    )
    return result
