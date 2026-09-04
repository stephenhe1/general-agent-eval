from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ClearedTestPath:
    path: str
    kind: str
    rule: str


@dataclass(frozen=True)
class PreservedSuspiciousPath:
    path: str
    kind: str
    rule: str


@dataclass(frozen=True)
class TestClearingResult:
    root: Path
    removed: tuple[ClearedTestPath, ...]
    preserved_suspicious: tuple[PreservedSuspiciousPath, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "root": str(self.root),
            "removed_count": len(self.removed),
            "removed": [
                {"path": item.path, "kind": item.kind, "rule": item.rule}
                for item in self.removed
            ],
            "preserved_suspicious_count": len(self.preserved_suspicious),
            "preserved_suspicious": [
                {"path": item.path, "kind": item.kind, "rule": item.rule}
                for item in self.preserved_suspicious
            ],
        }


class ClearingError(RuntimeError):
    pass


# Directories whose contents must never be scanned or removed: package vendors,
# build outputs, framework caches, and git metadata. Pruning these in the
# topdown walk is critical both for performance (node_modules can be huge) and
# correctness (vendored packages ship their own __tests__ / *.test.js files that
# are not part of the project's test suite).
PRUNE_DIR_NAMES = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".solid",
    "coverage",
    ".cache",
    ".turbo",
    ".parcel-cache",
    ".vite",
}

# Directory names that are considered test roots. An exact match against the
# directory's own name (case-insensitive, normalized) triggers removal.
TEST_DIR_NAMES = {
    "__tests__",
    "__mocks__",
    "cypress",
    "e2e",
    "test",
    "tests",
    "spec",
    "specs",
    "playwright",
}

# File names matching this pattern are considered test files. Matches the
# common JS/TS test file conventions: *.test.*, *.spec.*, *.cy.*.
TEST_FILE_PATTERN = re.compile(
    r".*\.(?:test|spec|cy)\.(?:js|jsx|ts|tsx|mjs|cjs)$"
)


def _normalized_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def _relative_path(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _remove_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
        return
    if path.is_dir():
        shutil.rmtree(path)


def clear_js_tests(root: str | Path) -> TestClearingResult:
    resolved_root = Path(root).expanduser().resolve()
    if not resolved_root.exists():
        raise ClearingError(f"Root does not exist: {root}")
    if not resolved_root.is_dir():
        raise ClearingError(f"Root is not a directory: {root}")

    removed: list[ClearedTestPath] = []
    paths_to_remove: list[Path] = []

    for current_dir, dir_names, file_names in os.walk(resolved_root, topdown=True):
        current_path = Path(current_dir)

        # Prune directories that must never be descended into. Mutating
        # dir_names in-place with topdown=True prevents os.walk from recursing.
        for prune in PRUNE_DIR_NAMES:
            if prune in dir_names:
                dir_names.remove(prune)

        for dirname in tuple(dir_names):
            normalized = _normalized_name(dirname)
            if normalized in TEST_DIR_NAMES:
                path = current_path / dirname
                dir_names.remove(dirname)
                removed.append(
                    ClearedTestPath(
                        path=_relative_path(resolved_root, path),
                        kind="directory",
                        rule=f"{dirname} test directory",
                    )
                )
                paths_to_remove.append(path)

        for filename in file_names:
            if TEST_FILE_PATTERN.fullmatch(filename):
                path = current_path / filename
                removed.append(
                    ClearedTestPath(
                        path=_relative_path(resolved_root, path),
                        kind="file",
                        rule="JS test filename (*.test/spec/cy.*)",
                    )
                )
                paths_to_remove.append(path)

    for path in paths_to_remove:
        _remove_path(path)

    return TestClearingResult(
        root=resolved_root,
        removed=tuple(removed),
        preserved_suspicious=(),
    )
