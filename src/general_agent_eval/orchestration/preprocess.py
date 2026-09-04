"""Preprocess the staged input: git reset and test clearing."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import TYPE_CHECKING, Any

from general_agent_eval.orchestration.errors import DockerRunError
from general_agent_eval.orchestration.manifest import write_manifest
from general_agent_eval.orchestration.manifest_paths import relativize_cleared_tests
from general_agent_eval.orchestration.staging import (
    git_repo_root,
    initialize_synthetic_git_baseline,
    write_git_patch,
)

if TYPE_CHECKING:
    from general_agent_eval.preprocessing.git_reset import GitResetTarget


def preprocess_staged_input(
    *,
    args: argparse.Namespace,
    staged_input: Path,
    output_dir: Path,
    reset_target: GitResetTarget | None = None,
    service: dict[str, Any] | None = None,
) -> dict[str, Any]:
    preprocessing: dict[str, Any] = {
        "reset_git": {"enabled": args.reset_git},
        "test_clearing": {"enabled": args.clear_tests},
    }

    if args.reset_git:
        from general_agent_eval.preprocessing.git_reset import (
            GitVcsError,
            reset_to_commit,
            reset_to_pinned_commit,
        )

        try:
            if reset_target is None:
                result = reset_to_pinned_commit(staged_input)
            else:
                result = reset_to_commit(
                    staged_input,
                    reset_target.pinned_commit,
                    reset_target=reset_target,
                )
        except GitVcsError as exc:
            raise DockerRunError(f"Failed to reset staged Git state: {exc}") from exc
        preprocessing["reset_git"] = {
            "enabled": True,
            "repo_root": str(result.repo_root),
            "pinned_commit": result.pinned_commit,
            "source_repo_root": (
                str(reset_target.repo_root) if reset_target is not None else None
            ),
            "superproject_root": (
                str(result.superproject_root) if result.superproject_root else None
            ),
            "superproject_relative_path": result.superproject_relative_path,
        }
        print(
            "[git-reset] " f"repo={result.repo_root} commit={result.pinned_commit}",
            flush=True,
        )

    should_clear = args.clear_tests and getattr(args, "mode", "baseline") != "project-aware"

    if should_clear:
        from general_agent_eval.preprocessing.js_test_clearing import (
            ClearingError,
            clear_js_tests,
        )

        try:
            clear_result = clear_js_tests(staged_input)
        except ClearingError as exc:
            raise DockerRunError(f"Failed to clear tests: {exc}") from exc

        clearing_manifest_path = output_dir / "cleared_tests.json"
        # output_dir is <run_dir>/output, so its parent is the run dir we anchor to.
        write_manifest(
            clearing_manifest_path,
            relativize_cleared_tests(clear_result.to_dict(), output_dir.parent),
        )

        clearing_patch_path = output_dir / "test_clearing.patch"
        clearing_patch = None
        if git_repo_root(staged_input) == staged_input:
            write_git_patch(
                staged_input=staged_input,
                output_path=clearing_patch_path,
                relative_paths=[item.path for item in clear_result.removed],
            )
            clearing_patch = str(clearing_patch_path)

        preprocessing["test_clearing"] = {
            "enabled": True,
            "removed_count": len(clear_result.removed),
            "manifest_path": str(clearing_manifest_path),
            "test_clearing_patch": clearing_patch,
        }
        print(
            "[test-clearing] "
            f"removed={len(clear_result.removed)} manifest={clearing_manifest_path}",
            flush=True,
        )

    # Commit the testless baseline after clearing so the cleared tree lands in
    # the baseline and stays out of the agent's diff.
    if should_clear:
        git_baseline = initialize_synthetic_git_baseline(staged_input)
        preprocessing["git_baseline"] = git_baseline
        preprocessing["test_clearing"]["git_history_sanitized"] = True
        preprocessing["test_clearing"]["git_baseline"] = git_baseline

    return preprocessing
