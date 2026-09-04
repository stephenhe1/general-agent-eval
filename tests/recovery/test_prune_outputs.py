from __future__ import annotations

import json
from pathlib import Path

import pytest

from general_agent_eval.recovery import prune_outputs as po


def write_run(run_dir: Path, *, with_input: bool = True) -> Path:
    """Create a minimal run dir with manifest.json, output/, and (optionally) input/."""
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "manifest.json").write_text(
        json.dumps({"run_dir": "."}, indent=2) + "\n", encoding="utf-8"
    )
    output = run_dir / "output"
    output.mkdir(exist_ok=True)
    (output / "git_diff.patch").write_text("diff --git a b\n", encoding="utf-8")
    (output / "messages.jsonl").write_text('{"role":"user"}\n', encoding="utf-8")
    if with_input:
        staged = run_dir / "input" / "src"
        staged.mkdir(parents=True, exist_ok=True)
        (staged / "Main.java").write_text("class Main {}\n", encoding="utf-8")
        (run_dir / "input" / ".git").mkdir(exist_ok=True)
    return run_dir


def test_prunes_input_and_copies_everything_else(tmp_path: Path) -> None:
    src = tmp_path / "runs"
    write_run(src / "run1")
    write_run(src / "run2")
    out = tmp_path / "slim"

    results = po.prune_runs(src, out, dry_run=False, force=False)

    assert len(results) == 2
    for result in results:
        dest = out / result.run_dir.name
        assert (dest / "manifest.json").is_file()
        assert (dest / "output" / "git_diff.patch").is_file()
        assert (dest / "output" / "messages.jsonl").is_file()
        # The input/ workspace is never copied.
        assert not (dest / "input").exists()
        assert result.excluded
        assert "input" not in result.copied


def test_keeps_run_without_input(tmp_path: Path) -> None:
    src = tmp_path / "runs"
    write_run(src / "run1", with_input=False)
    out = tmp_path / "slim"

    results = po.prune_runs(src, out, dry_run=False, force=False)

    assert not results[0].excluded
    assert (out / "run1" / "manifest.json").is_file()
    assert not (out / "run1" / "input").exists()


def test_dry_run_writes_nothing(tmp_path: Path) -> None:
    src = tmp_path / "runs"
    write_run(src / "run1")
    out = tmp_path / "slim"

    results = po.prune_runs(src, out, dry_run=True, force=False)

    assert results[0].copied  # would copy
    assert results[0].bytes_copied > 0
    assert not out.exists()


def test_single_run_dir_input(tmp_path: Path) -> None:
    run = write_run(tmp_path / "runs" / "only")
    out = tmp_path / "slim"

    results = po.prune_runs(run, out, dry_run=False, force=False)

    assert len(results) == 1
    assert (out / "only" / "manifest.json").is_file()
    assert not (out / "only" / "input").exists()


def test_existing_destination_skipped_without_force(tmp_path: Path) -> None:
    src = tmp_path / "runs"
    write_run(src / "run1")
    out = tmp_path / "slim"
    # Pre-create a destination run with a sentinel file.
    (out / "run1").mkdir(parents=True)
    (out / "run1" / "sentinel.txt").write_text("keep", encoding="utf-8")

    results = po.prune_runs(src, out, dry_run=False, force=False)

    assert results[0].skipped_reason is not None
    assert (out / "run1" / "sentinel.txt").is_file()  # untouched
    assert not (out / "run1" / "manifest.json").exists()


def test_force_overwrites_destination(tmp_path: Path) -> None:
    src = tmp_path / "runs"
    write_run(src / "run1")
    out = tmp_path / "slim"
    (out / "run1").mkdir(parents=True)
    (out / "run1" / "sentinel.txt").write_text("stale", encoding="utf-8")

    results = po.prune_runs(src, out, dry_run=False, force=True)

    assert results[0].skipped_reason is None
    assert not (out / "run1" / "sentinel.txt").exists()  # replaced
    assert (out / "run1" / "manifest.json").is_file()


def test_output_inside_input_is_rejected(tmp_path: Path) -> None:
    src = tmp_path / "runs"
    write_run(src / "run1")

    with pytest.raises(po.PruneError, match="must not be inside"):
        po.prune_runs(src, src / "slim", dry_run=False, force=False)


def test_output_equals_input_is_rejected(tmp_path: Path) -> None:
    src = tmp_path / "runs"
    write_run(src / "run1")

    with pytest.raises(po.PruneError, match="must differ"):
        po.prune_runs(src, src, dry_run=False, force=False)


def test_empty_input_errors(tmp_path: Path) -> None:
    (tmp_path / "empty").mkdir()
    with pytest.raises(po.PruneError, match="no run directories"):
        po.prune_runs(tmp_path / "empty", tmp_path / "slim", dry_run=False, force=False)


def test_main_returns_zero_and_copies(tmp_path: Path) -> None:
    src = tmp_path / "runs"
    write_run(src / "run1")
    out = tmp_path / "slim"

    assert po.main(["--input-dir", str(src), "--output-dir", str(out)]) == 0
    assert (out / "run1" / "manifest.json").is_file()
    assert not (out / "run1" / "input").exists()
