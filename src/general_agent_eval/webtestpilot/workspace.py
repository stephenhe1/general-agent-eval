"""Sanitized generation workspace and leakage auditing.

The generation agent must see only what a legitimate autonomous test generator
could see: a Playwright scaffold plus the operating information needed to drive
the running application. The benchmark specs, bug scripts, ground truth, and the
evaluator itself belong to the outer evaluator and must never enter the
workspace.

Two levels of guarantee are supported:

``docker``  The agent runs against a staged copy inside a container that mounts
            only the staged workspace. The benchmark is not present in the
            container filesystem at all, so leakage is structurally impossible.

``host``    The agent runs on the host. The workspace is still sanitized and
            lives outside the benchmark tree, but a host-mode agent could in
            principle read any path the user can. This mode therefore adds a
            post-hoc transcript audit and records a reduced guarantee level.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from general_agent_eval.webtestpilot.apps import (
    APPS,
    VIEWPORT_HEIGHT,
    VIEWPORT_WIDTH,
    AppSpec,
)

# Substrings whose presence anywhere in the workspace means the benchmark leaked.
FORBIDDEN_MARKERS: tuple[str, ...] = (
    "isConditionMet",
    "onConditionMet",
    "__BUG_INJECTOR_TRIGGERED__",
    "BUG_INJECTOR",
    "ground_truth",
    "to_match_aria_snapshot",
    # NOT the bare lowercase "webtestpilot": that string is legitimate application data for
    # two subjects — Indico's admin password is literally `webtestpilot`, and PrestaShop's
    # admin folder is `/webtestpilot/` (PS_FOLDER_ADMIN). Both belong in APP_NOTES.md as
    # operating information the agent needs, so matching it would fail every Indico and
    # PrestaShop run on correct content. The capitalised repository name remains a marker.
    "WebTestPilot",
    "prepare_bug_script",
    "bug_injector",
)

# Path fragments that must not appear as files in the workspace.
FORBIDDEN_PATH_FRAGMENTS: tuple[str, ...] = (
    "benchmark/",
    "/bugs/",
    "test_cases/",
    "baselines/",
)

_SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "playwright-report", "test-results"}
_TEXT_SUFFIXES = {
    ".ts", ".js", ".tsx", ".jsx", ".mjs", ".cjs", ".json", ".md", ".yaml", ".yml",
    ".txt", ".html", ".css", ".sh", ".py", ".env",
}


class LeakageError(RuntimeError):
    pass


@dataclass
class LeakageFinding:
    path: str
    kind: str
    detail: str


@dataclass
class LeakageAudit:
    guarantee: str
    scanned_files: int = 0
    findings: list[LeakageFinding] = field(default_factory=list)

    @property
    def clean(self) -> bool:
        return not self.findings

    def to_dict(self) -> dict[str, object]:
        return {
            "guarantee": self.guarantee,
            "clean": self.clean,
            "scanned_files": self.scanned_files,
            "finding_count": len(self.findings),
            "findings": [
                {"path": f.path, "kind": f.kind, "detail": f.detail} for f in self.findings
            ],
        }


PACKAGE_JSON = {
    "name": "wtp-baseline-suite",
    "private": True,
    "version": "0.0.0",
    "description": "Playwright end-to-end test project.",
    "scripts": {"test": "playwright test"},
    "devDependencies": {"@playwright/test": "^1.49.0"},
}

PLAYWRIGHT_CONFIG = """import {{ defineConfig, devices }} from '@playwright/test';

export default defineConfig({{
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  timeout: 60_000,
  use: {{
    baseURL: process.env.PLAYWRIGHT_BASE_URL || '{base_url}',
    viewport: {{ width: {width}, height: {height} }},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
  }},
  projects: [
    {{ name: 'chromium', use: {{ ...devices['Desktop Chrome'], viewport: {{ width: {width}, height: {height} }} }} }},
  ],
}});
"""

APP_NOTES = """# {title} — application under test

A running instance is available at {base_url}. It is already built, seeded, and
started; do not attempt to build, start, stop, or reconfigure it.

This project directory contains no application source. {title} is a third-party
application running as a prepared service, so the UI is a black box: discover its
pages, flows, and behaviour by navigating the live instance.

{notes}

## Accounts

{accounts}

## Data

The instance is seeded with deterministic starting data and is reset to that same
state before each evaluation run. You may create, edit, and delete data freely
while exploring and while your tests run.

## Viewport

Tests are executed at {width}x{height}. Keep that viewport in mind for anything
layout- or responsive-dependent.
"""


def _accounts_block(spec: AppSpec) -> str:
    lines = []
    for role, creds in spec.credentials.items():
        lines.append(f"- **{role}** — username `{creds['username']}`, password `{creds['password']}`")
    return "\n".join(lines)


def build_workspace(app: str, destination: Path, *, base_url: str | None = None) -> Path:
    """Create a sanitized Playwright scaffold for one application."""
    spec = APPS[app]
    url = base_url or spec.base_url
    destination.mkdir(parents=True, exist_ok=True)

    (destination / "package.json").write_text(json.dumps(PACKAGE_JSON, indent=2) + "\n", "utf-8")
    (destination / "playwright.config.ts").write_text(
        PLAYWRIGHT_CONFIG.format(base_url=url, width=VIEWPORT_WIDTH, height=VIEWPORT_HEIGHT),
        "utf-8",
    )
    (destination / "APP_NOTES.md").write_text(
        APP_NOTES.format(
            title=spec.name.capitalize(),
            base_url=url,
            notes=spec.notes,
            accounts=_accounts_block(spec),
            width=VIEWPORT_WIDTH,
            height=VIEWPORT_HEIGHT,
        ),
        "utf-8",
    )
    (destination / ".gitignore").write_text(
        "node_modules/\nplaywright-report/\ntest-results/\n", "utf-8"
    )
    return destination


def provision_workspace(root: Path, *, timeout: int = 1800) -> list[str]:
    """Install Playwright into the workspace before the agent runs.

    A real project comes with its dependencies resolvable; the scaffold should
    too. Without this the agent burns turns on `npm ci` against a workspace that
    has no lockfile, and a provisioning failure would show up as a generation
    failure rather than as what it is.

    Returns a list of step descriptions that failed (empty means fully provisioned).
    """
    failures: list[str] = []
    steps = [
        (["npm", "install", "--no-audit", "--no-fund"], "npm install"),
        (["npx", "--yes", "playwright", "install", "chromium"], "playwright install chromium"),
    ]
    for command, label in steps:
        result = subprocess.run(
            command,
            cwd=str(root),
            capture_output=True,
            text=True,
            timeout=timeout,
            # Keep npm from walking up into an unrelated parent workspace.
            env={**os.environ, "npm_config_workspaces": "false"},
        )
        if result.returncode != 0:
            failures.append(f"{label}: exit {result.returncode}: {result.stderr[-600:]}")
    return failures


def provision_workspace_in_container(
    root: Path,
    *,
    image: str,
    runtime: str = "podman",
    timeout: int = 2400,
) -> list[str]:
    """Install the workspace's dependencies inside the container that will run them.

    Native modules and browser binaries are platform-specific, so installing on a macOS host
    and then executing under Linux does not work. The browsers themselves already live in the
    image, so only the npm tree is built here.
    """
    failures: list[str] = []
    result = subprocess.run(
        [
            runtime, "run", "--rm", "--platform", "linux/arm64", "--network", "host",
            "-v", f"{root}:/workspace:rw", "-w", "/workspace", image,
            "bash", "-lc", "npm install --no-audit --no-fund",
        ],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        failures.append(
            f"container npm install: exit {result.returncode}: {result.stderr[-600:]}"
        )
    return failures


def reprovision_for_host(root: Path, *, timeout: int = 2400) -> list[str]:
    """Replace a container-built dependency tree with a host-native one."""
    node_modules = root / "node_modules"
    if node_modules.exists():
        shutil.rmtree(node_modules, ignore_errors=True)
    return provision_workspace(root, timeout=timeout)


def audit_workspace(root: Path, *, guarantee: str) -> LeakageAudit:
    """Scan a workspace for any benchmark material that must not be there."""
    audit = LeakageAudit(guarantee=guarantee)
    root = root.resolve()

    for path in sorted(root.rglob("*")):
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        relative = path.relative_to(root).as_posix()

        if path.is_dir():
            for fragment in FORBIDDEN_PATH_FRAGMENTS:
                if fragment.strip("/") == path.name:
                    audit.findings.append(
                        LeakageFinding(relative, "forbidden_directory", f"matches {fragment!r}")
                    )
            continue

        if path.suffix.lower() not in _TEXT_SUFFIXES:
            continue

        audit.scanned_files += 1
        try:
            content = path.read_text("utf-8", errors="ignore")
        except OSError as exc:  # unreadable file is itself worth surfacing
            audit.findings.append(LeakageFinding(relative, "unreadable", str(exc)))
            continue

        for marker in FORBIDDEN_MARKERS:
            if marker in content:
                audit.findings.append(
                    LeakageFinding(relative, "forbidden_marker", f"contains {marker!r}")
                )

    return audit


# Markers whose presence in a transcript means the agent touched benchmark material.
# Plain substrings, deliberately NOT a regex: the previous pattern combined a leading
# `[^\s"\']*` with alternatives of the same shape, which backtracks quadratically. Agent
# transcripts contain single JSONL lines of several hundred thousand characters (embedded
# Playwright output), where that cost is minutes per line and stalls the whole pipeline.
_TRANSCRIPT_MARKERS: tuple[str, ...] = (
    "WebTestPilot",
    "/benchmark/",
    "/bugs/",
    "test_cases/",
    "bug_injector",
    "isConditionMet",
    "onConditionMet",
    "__BUG_INJECTOR_TRIGGERED__",
    "ground_truth",
)

# Characters that delimit a path-ish token, used to widen a hit into readable context.
_TOKEN_BREAK = set(" \t\"'\\,;()[]{}<>")
# Maximum context characters kept around a hit.
_CONTEXT = 80


def _context_around(line: str, index: int, length: int) -> str:
    """Widen a marker hit to its surrounding token, bounded. Linear, no backtracking."""
    left = index
    while left > 0 and line[left - 1] not in _TOKEN_BREAK and index - left < _CONTEXT:
        left -= 1
    right = index + length
    while right < len(line) and line[right] not in _TOKEN_BREAK and right - index < _CONTEXT:
        right += 1
    return line[left:right][: _CONTEXT * 2]


def audit_transcript(messages_jsonl: Path) -> LeakageAudit:
    """Scan an agent transcript for evidence it touched benchmark material.

    This is the host-mode backstop: the workspace is sanitized, but only a
    container can *prevent* an agent from reading elsewhere on the filesystem.
    A clean transcript is evidence of no leakage, not proof of impossibility.
    """
    audit = LeakageAudit(guarantee="host-transcript-audit")
    if not messages_jsonl.is_file():
        audit.findings.append(
            LeakageFinding(str(messages_jsonl), "missing_transcript", "no transcript to audit")
        )
        return audit

    for line_number, line in enumerate(
        messages_jsonl.read_text("utf-8", errors="ignore").splitlines(), start=1
    ):
        if not line.strip():
            continue
        audit.scanned_files += 1
        # Work on the raw line: tool inputs, outputs, and text all live in it. Each marker is
        # located with str.find, which is linear, so a 400k-character line costs microseconds.
        for marker in _TRANSCRIPT_MARKERS:
            index = line.find(marker)
            if index < 0:
                continue
            audit.findings.append(
                LeakageFinding(
                    f"{messages_jsonl.name}:{line_number}",
                    "benchmark_path_reference",
                    _context_around(line, index, len(marker)),
                )
            )
    return audit
