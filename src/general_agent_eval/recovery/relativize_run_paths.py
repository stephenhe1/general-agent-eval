"""Rewrite absolute host paths in completed runs to run-relative paths.

Legacy runs recorded absolute paths in ``manifest.json`` and
``output/cleared_tests.json`` (e.g. ``/Users/<user>/.../runs/<run>/input``),
leaking the operator's home directory and breaking when a run is moved or shared.
This tool walks a directory of runs and rewrites those path fields relative to
each run's own directory, using the exact scheme new runs now emit
(:mod:`general_agent_eval.orchestration.manifest_paths`).

The rewrite is idempotent (already-relative runs are left untouched) and purely
lexical: it anchors on the *recorded* ``run_dir`` from the file, not the run's
current location, so a run already moved on disk still rewrites correctly.

Usage::

    python -m general_agent_eval.recovery.relativize_run_paths RUNS_DIR [--dry-run]

``RUNS_DIR`` may be a directory of run subdirectories (each containing
``manifest.json``) or a single run directory. ``--check`` runs without writing
and exits non-zero if any run is not already relative (a CI gate); ``--strict``
exits non-zero when a host path remains in a free-text/unregistered field.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from general_agent_eval.orchestration.manifest_paths import (
    find_residual_host_paths,
    relativize_cleared_tests,
    relativize_manifest,
)

MANIFEST_NAME = "manifest.json"
CLEARED_TESTS_RELPATH = ("output", "cleared_tests.json")


class RelativizeError(RuntimeError):
    pass


@dataclass
class FileResult:
    path: Path
    changes: list[tuple[str, str, str]] = field(default_factory=list)
    residual: list[tuple[str, str]] = field(default_factory=list)
    written: bool = False
    skipped_reason: str | None = None


@dataclass
class RunResult:
    run_dir: Path
    files: list[FileResult] = field(default_factory=list)
    error: str | None = None

    @property
    def changed(self) -> bool:
        return any(f.changes for f in self.files)

    @property
    def residual(self) -> list[tuple[Path, str, str]]:
        return [(f.path, ptr, val) for f in self.files for ptr, val in f.residual]


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RelativizeError(f"invalid JSON: {path}: {exc}") from exc


def _dump_json(payload: Any) -> str:
    # Match orchestration.manifest.write_manifest so rewritten and freshly
    # generated files are byte-for-byte identical (sorted keys, 2-space indent).
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def _diff_strings(
    old: Any, new: Any, pointer: str = ""
) -> list[tuple[str, str, str]]:
    """Leaf string values that differ between ``old`` and ``new``, as
    ``(json_pointer, old, new)``. Only paths change, so every diff is a rewrite."""
    changes: list[tuple[str, str, str]] = []
    if isinstance(old, dict) and isinstance(new, dict):
        for key in old:
            if key in new:
                changes.extend(_diff_strings(old[key], new[key], f"{pointer}/{key}"))
    elif isinstance(old, list) and isinstance(new, list) and len(old) == len(new):
        for index, (a, b) in enumerate(zip(old, new)):
            changes.extend(_diff_strings(a, b, f"{pointer}/{index}"))
    elif isinstance(old, str) and isinstance(new, str) and old != new:
        changes.append((pointer or "/", old, new))
    return changes


def discover_run_dirs(root: Path) -> list[Path]:
    """Run dirs under ``root``: ``root`` itself if it holds a manifest, else its
    immediate children that do."""
    if (root / MANIFEST_NAME).is_file():
        return [root]
    return sorted(
        child
        for child in root.iterdir()
        if child.is_dir() and (child / MANIFEST_NAME).is_file()
    )


def _manifest_anchor(manifest: dict[str, Any]) -> str | None:
    """Absolute run dir for the manifest, or None when it is already relative.

    Prefers the recorded ``run_dir``; failing that, derives it from a child path
    (``<run_dir>/input`` or ``<run_dir>/output``) so a manifest that somehow lacks
    an absolute ``run_dir`` still rewrites — mirroring ``_cleared_tests_anchor``."""
    run_dir = manifest.get("run_dir")
    if isinstance(run_dir, str) and os.path.isabs(run_dir):
        return run_dir
    candidates = [manifest.get("staged_input"), manifest.get("output_dir")]
    reset_git = (manifest.get("preprocessing") or {}).get("reset_git") or {}
    candidates.append(reset_git.get("repo_root"))  # also <run_dir>/input
    for value in candidates:
        if isinstance(value, str) and os.path.isabs(value):
            return os.path.dirname(value)
    return None


def _cleared_tests_anchor(
    manifest_anchor: str | None, payload: dict[str, Any]
) -> str | None:
    """Anchor for ``cleared_tests.json``. Prefer the manifest's run dir; else
    derive it from the recorded ``root`` (``<run_dir>/input``) so a partially
    rewritten run still finishes."""
    if manifest_anchor is not None:
        return manifest_anchor
    root = payload.get("root")
    if isinstance(root, str) and os.path.isabs(root):
        return os.path.dirname(root)
    return None


def _process_file(
    path: Path,
    relativize: Any,
    anchor: str | None,
    *,
    dry_run: bool,
) -> FileResult:
    result = FileResult(path=path)
    payload = _load_json(path)
    if anchor is not None:
        rewritten = relativize(payload, anchor)
        result.changes = _diff_strings(payload, rewritten)
        if result.changes and not dry_run:
            path.write_text(_dump_json(rewritten), encoding="utf-8")
            result.written = True
    else:
        rewritten = payload
        result.skipped_reason = "no absolute run-dir anchor (nothing to rewrite)"

    # Audit for residual host paths regardless of whether a rewrite was possible,
    # so already-relative runs are still scanned. Anchor the home-prefix check on
    # the rewrite anchor when present (precise even for another machine's home),
    # else the current user's home.
    residual_anchor = anchor if anchor is not None else str(Path.home())
    result.residual = list(find_residual_host_paths(rewritten, residual_anchor))
    return result


def relativize_run(run_dir: Path, *, dry_run: bool) -> RunResult:
    result = RunResult(run_dir=run_dir)
    manifest_path = run_dir / MANIFEST_NAME
    try:
        manifest = _load_json(manifest_path)
        if not isinstance(manifest, dict):
            raise RelativizeError(f"manifest is not a JSON object: {manifest_path}")
        anchor = _manifest_anchor(manifest)
        result.files.append(
            _process_file(
                manifest_path, relativize_manifest, anchor, dry_run=dry_run
            )
        )

        cleared_tests_path = run_dir.joinpath(*CLEARED_TESTS_RELPATH)
        if cleared_tests_path.is_file():
            payload = _load_json(cleared_tests_path)
            ct_anchor = (
                _cleared_tests_anchor(anchor, payload)
                if isinstance(payload, dict)
                else None
            )
            result.files.append(
                _process_file(
                    cleared_tests_path,
                    relativize_cleared_tests,
                    ct_anchor,
                    dry_run=dry_run,
                )
            )
    except RelativizeError as exc:
        result.error = str(exc)
    return result


def relativize_runs(runs_dir: Path, *, dry_run: bool) -> list[RunResult]:
    run_dirs = discover_run_dirs(runs_dir)
    if not run_dirs:
        raise RelativizeError(
            f"no run directories (with {MANIFEST_NAME}) found under: {runs_dir}"
        )
    return [relativize_run(run_dir, dry_run=dry_run) for run_dir in run_dirs]


def _report(results: list[RunResult], *, dry_run: bool) -> tuple[int, int, int]:
    verb = "would rewrite" if dry_run else "rewrote"
    changed_runs = errored = residual_runs = 0
    for run in results:
        name = run.run_dir.name
        if run.error:
            errored += 1
            print(f"[relativize] ERROR {name}: {run.error}", flush=True)
            continue
        if run.changed:
            changed_runs += 1
            total = sum(len(f.changes) for f in run.files)
            print(f"[relativize] {verb} {name}: {total} path(s)", flush=True)
            for file_result in run.files:
                for pointer, old, new in file_result.changes:
                    print(f"    {file_result.path.name}{pointer}: {old} -> {new}")
        else:
            print(f"[relativize] {name}: already relative", flush=True)
        if run.residual:
            residual_runs += 1
            for path, pointer, value in run.residual:
                print(
                    f"[relativize] WARNING residual host path in {path.name}"
                    f"{pointer}: {value} (left as-is: free-text value or "
                    "unregistered field — review before sharing)",
                    flush=True,
                )
    return changed_runs, errored, residual_runs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Rewrite absolute host paths in completed runs' manifest.json and "
            "cleared_tests.json to paths relative to each run's directory."
        )
    )
    parser.add_argument(
        "runs_dir",
        type=Path,
        help=(
            "Directory of run subdirectories (each with manifest.json), or a "
            "single run directory."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would change without writing any files (exit reflects errors only).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Implies --dry-run; exit non-zero if any run is not already relative "
        "(a CI/pre-commit gate).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Also exit non-zero when a residual host path remains in a non-path "
        "field (free-text or unregistered).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    runs_dir = args.runs_dir.expanduser().resolve()
    if not runs_dir.is_dir():
        parser.exit(2, f"error: not a directory: {runs_dir}\n")

    dry_run = args.dry_run or args.check
    try:
        results = relativize_runs(runs_dir, dry_run=dry_run)
    except RelativizeError as exc:
        parser.exit(2, f"error: {exc}\n")
    except KeyboardInterrupt:
        parser.exit(130, "interrupted\n")

    changed, errored, residual = _report(results, dry_run=dry_run)
    print(
        f"[relativize] runs={len(results)} changed={changed} "
        f"errors={errored} residual_leaks={residual}",
        flush=True,
    )
    # Parse errors always fail. Residual leaks are advisory (warnings) unless
    # --strict; --check turns "changes still pending" into a gate failure.
    if errored:
        return 1
    if args.check and changed:
        return 1
    if args.strict and residual:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
