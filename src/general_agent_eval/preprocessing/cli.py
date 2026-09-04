"""Standalone CLI for clearing JavaScript test files from a repository."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from general_agent_eval.preprocessing.js_test_clearing import (
    ClearingError,
    TestClearingResult,
    clear_js_tests,
)


def _dry_run(root: Path) -> TestClearingResult:
    """Walk the tree and report what would be removed without deleting anything."""
    import os
    import re

    from general_agent_eval.preprocessing.js_test_clearing import (
        ClearedTestPath,
        PRUNE_DIR_NAMES,
        TEST_DIR_NAMES,
        TEST_FILE_PATTERN,
    )

    resolved_root = root.expanduser().resolve()
    if not resolved_root.exists():
        raise ClearingError(f"Root does not exist: {root}")
    if not resolved_root.is_dir():
        raise ClearingError(f"Root is not a directory: {root}")

    removed: list[ClearedTestPath] = []

    def _normalized_name(name: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", name.lower())

    for current_dir, dir_names, file_names in os.walk(resolved_root, topdown=True):
        current_path = Path(current_dir)

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
                        path=path.relative_to(resolved_root).as_posix(),
                        kind="directory",
                        rule=f"{dirname} test directory",
                    )
                )

        for filename in file_names:
            if TEST_FILE_PATTERN.fullmatch(filename):
                path = current_path / filename
                removed.append(
                    ClearedTestPath(
                        path=path.relative_to(resolved_root).as_posix(),
                        kind="file",
                        rule="JS test filename (*.test/spec/cy.*)",
                    )
                )

    return TestClearingResult(
        root=resolved_root,
        removed=tuple(removed),
        preserved_suspicious=(),
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Remove JavaScript test files and directories from a repository."
    )
    parser.add_argument(
        "--input-dir",
        required=True,
        type=Path,
        help="Root directory to clear tests from.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be removed without deleting anything.",
    )
    parser.add_argument(
        "--output-json",
        type=Path,
        help="Write the clearing manifest to this path (JSON).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    input_dir = args.input_dir.expanduser().resolve()
    if not input_dir.exists():
        parser.exit(2, f"error: --input-dir does not exist: {args.input_dir}\n")
    if not input_dir.is_dir():
        parser.exit(2, f"error: --input-dir is not a directory: {args.input_dir}\n")

    try:
        if args.dry_run:
            result = _dry_run(input_dir)
            label = "[dry-run]"
        else:
            result = clear_js_tests(input_dir)
            label = "[test-clearing]"
    except ClearingError as exc:
        parser.exit(2, f"error: {exc}\n")
        return 2  # unreachable but satisfies type checkers

    print(f"{label} removed={len(result.removed)} root={result.root}", flush=True)
    for item in result.removed:
        print(f"  {item.kind}: {item.path} ({item.rule})", flush=True)

    if args.output_json:
        output_path = args.output_json.expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(result.to_dict(), indent=2) + "\n", encoding="utf-8"
        )
        print(f"{label} manifest written to {output_path}", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
