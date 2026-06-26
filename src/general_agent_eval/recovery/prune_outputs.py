"""Copy completed runs into a new directory, excluding each run's ``input/``.

A run's ``input/`` is the agent's staged workspace — a full, preprocessed repo
checkout — and dominates the run's on-disk size. It is *not* needed to recover
the agent's work: :mod:`general_agent_eval.recovery.recover_full_repo`
reconstructs from ``manifest.json`` + ``output/`` applied onto a fresh clone of
the original upstream repo. This tool produces a slim, shareable copy of a runs
directory that keeps everything except ``input/``.

Usage::

    python -m general_agent_eval.recovery.prune_outputs \\
        --input-dir runs/co_aster_runs --output-dir runs/co_aster_runs_slim \\
        [--dry-run] [--force]

``--input-dir`` is a directory of run subdirectories (each with ``manifest.json``)
or a single run directory. ``--output-dir`` is created if missing and must live
outside ``--input-dir``. ``--force`` overwrites an existing destination run;
otherwise a pre-existing destination run is left untouched and reported.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

from general_agent_eval.recovery.relativize_run_paths import discover_run_dirs

EXCLUDED = "input"


class PruneError(RuntimeError):
    pass


@dataclass
class RunResult:
    run_dir: Path
    dest: Path
    copied: list[str] = field(default_factory=list)
    excluded: bool = False
    bytes_copied: int = 0
    bytes_excluded: int = 0
    skipped_reason: str | None = None


def _dir_size(path: Path) -> int:
    """Total size of all files under ``path`` (follows no symlinks)."""
    if path.is_file():
        return path.stat().st_size
    total = 0
    for child in path.rglob("*"):
        if child.is_file() and not child.is_symlink():
            total += child.stat().st_size
    return total


def prune_run(run_dir: Path, dest: Path, *, dry_run: bool, force: bool) -> RunResult:
    """Copy ``run_dir`` to ``dest``, omitting the top-level ``input/`` dir."""
    result = RunResult(run_dir=run_dir, dest=dest)

    if dest.exists():
        if not force:
            result.skipped_reason = "destination exists (use --force to overwrite)"
            return result
        if not dry_run:
            shutil.rmtree(dest)

    for entry in sorted(run_dir.iterdir()):
        if entry.name == EXCLUDED:
            result.excluded = True
            result.bytes_excluded += _dir_size(entry)
            continue
        result.copied.append(entry.name)
        result.bytes_copied += _dir_size(entry)
        if dry_run:
            continue
        dest.mkdir(parents=True, exist_ok=True)
        target = dest / entry.name
        if entry.is_dir():
            shutil.copytree(entry, target)
        else:
            shutil.copy2(entry, target)

    return result


def _is_within(child: Path, parent: Path) -> bool:
    """True if ``child`` is ``parent`` or nested under it (lexical, resolved)."""
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def prune_runs(
    input_dir: Path, output_dir: Path, *, dry_run: bool, force: bool
) -> list[RunResult]:
    input_dir = input_dir.expanduser().resolve()
    output_dir = output_dir.expanduser().resolve()
    if not input_dir.is_dir():
        raise PruneError(f"input dir is not a directory: {input_dir}")
    if output_dir == input_dir:
        raise PruneError("output dir must differ from input dir")
    if _is_within(output_dir, input_dir):
        raise PruneError(
            f"output dir must not be inside input dir: {output_dir} is under {input_dir}"
        )

    run_dirs = discover_run_dirs(input_dir)
    if not run_dirs:
        raise PruneError(f"no run directories (with manifest.json) found under: {input_dir}")

    if not dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)
    return [
        prune_run(run_dir, output_dir / run_dir.name, dry_run=dry_run, force=force)
        for run_dir in run_dirs
    ]


def _human(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KiB", "MiB", "GiB", "TiB"):
        if size < 1024 or unit == "TiB":
            return f"{size:.1f}{unit}" if unit != "B" else f"{int(size)}B"
        size /= 1024
    return f"{size:.1f}TiB"


def _report(results: list[RunResult], *, dry_run: bool) -> tuple[int, int]:
    verb = "would copy" if dry_run else "copied"
    copied_runs = skipped_runs = 0
    total_copied = total_excluded = 0
    for run in results:
        name = run.run_dir.name
        if run.skipped_reason is not None:
            skipped_runs += 1
            print(f"[prune] SKIP {name}: {run.skipped_reason}", flush=True)
            continue
        copied_runs += 1
        total_copied += run.bytes_copied
        total_excluded += run.bytes_excluded
        excl = (
            f", excluded {EXCLUDED}/ ({_human(run.bytes_excluded)})"
            if run.excluded
            else f" (no {EXCLUDED}/ to exclude)"
        )
        print(
            f"[prune] {verb} {name}: {len(run.copied)} entr"
            f"{'y' if len(run.copied) == 1 else 'ies'} "
            f"({_human(run.bytes_copied)}){excl}",
            flush=True,
        )
    print(
        f"[prune] runs={len(results)} {verb.split()[-1]}={copied_runs} "
        f"skipped={skipped_runs} kept={_human(total_copied)} "
        f"saved={_human(total_excluded)}",
        flush=True,
    )
    return copied_runs, skipped_runs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Copy runs into a new directory, excluding each run's input/ workspace "
            "to produce a slim, shareable bundle."
        )
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        required=True,
        help="Directory of run subdirectories (each with manifest.json), or a single run.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Destination directory (created if missing); must be outside --input-dir.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be copied without writing any files.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite a destination run directory if it already exists.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        results = prune_runs(
            args.input_dir, args.output_dir, dry_run=args.dry_run, force=args.force
        )
    except PruneError as exc:
        parser.exit(2, f"error: {exc}\n")
    except KeyboardInterrupt:
        parser.exit(130, "interrupted\n")

    _copied, skipped = _report(results, dry_run=args.dry_run)
    # Skipped destinations (already present, no --force) are advisory, not failures.
    return 0


if __name__ == "__main__":
    sys.exit(main())
