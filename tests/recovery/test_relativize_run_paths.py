from __future__ import annotations

import json
from pathlib import Path

import pytest

from general_agent_eval.recovery import relativize_run_paths as rp


def write_run(
    run_dir: Path,
    *,
    anchor: str | None = None,
    with_cleared_tests: bool = True,
    extra_manifest: dict | None = None,
) -> Path:
    """Create a run dir with an absolute-path manifest (and cleared_tests).

    ``anchor`` is the value recorded as ``run_dir`` (defaults to the real path);
    all other paths are built under it so they relativize to known values.
    """
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "output").mkdir(exist_ok=True)
    base = run_dir.parent  # stands in for the project root
    anchor = anchor if anchor is not None else str(run_dir)
    manifest = {
        "run_dir": anchor,
        "output_root": str(base),
        "input_dir": str(base / "resources" / "proj"),
        "staged_input": f"{anchor}/input",
        "output_dir": f"{anchor}/output",
        "docker": {
            "layers": [{"name": "base", "dockerfile": str(base / "docker" / "Df.base")}]
        },
        "artifacts": {"git_diff.patch": f"{anchor}/output/git_diff.patch"},
        "preprocessing": {
            "reset_git": {
                "enabled": True,
                "repo_root": f"{anchor}/input",
                "superproject_root": str(base),
            }
        },
    }
    if extra_manifest:
        manifest.update(extra_manifest)
    (run_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    if with_cleared_tests:
        cleared = {
            "root": f"{anchor}/input",
            "removed": [{"path": "src/test", "kind": "directory", "rule": "src/test"}],
            "removed_count": 1,
        }
        (run_dir / "output" / "cleared_tests.json").write_text(
            json.dumps(cleared, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    return run_dir


def read_manifest(run_dir: Path) -> dict:
    return json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))


def read_cleared(run_dir: Path) -> dict:
    return json.loads(
        (run_dir / "output" / "cleared_tests.json").read_text(encoding="utf-8")
    )


def test_discover_run_dirs_children_and_single(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    a = write_run(runs / "a")
    b = write_run(runs / "b")
    (runs / "not-a-run").mkdir()  # no manifest -> ignored

    assert rp.discover_run_dirs(runs) == [a, b]
    # A run dir passed directly is discovered as itself.
    assert rp.discover_run_dirs(a) == [a]


def test_relativize_runs_rewrites_paths(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = write_run(runs / "run1")

    results = rp.relativize_runs(runs, dry_run=False)

    assert len(results) == 1 and results[0].changed and not results[0].error
    manifest = read_manifest(run)
    assert manifest["run_dir"] == "."
    assert manifest["staged_input"] == "input"
    assert manifest["output_dir"] == "output"
    assert manifest["output_root"] == ".."
    assert manifest["input_dir"] == "../resources/proj"
    assert manifest["docker"]["layers"][0]["dockerfile"] == "../docker/Df.base"
    assert manifest["artifacts"]["git_diff.patch"] == "output/git_diff.patch"
    assert manifest["preprocessing"]["reset_git"]["repo_root"] == "input"
    assert manifest["preprocessing"]["reset_git"]["superproject_root"] == ".."
    assert read_cleared(run)["root"] == "input"
    # No absolute paths remain anywhere in the rewritten manifest.
    assert not any(
        isinstance(v, str) and v.startswith("/")
        for v in _all_strings(manifest)
    )


def _all_strings(obj: object) -> list[str]:
    out: list[str] = []
    if isinstance(obj, dict):
        for v in obj.values():
            out.extend(_all_strings(v))
    elif isinstance(obj, list):
        for v in obj:
            out.extend(_all_strings(v))
    elif isinstance(obj, str):
        out.append(obj)
    return out


def test_idempotent(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = write_run(runs / "run1")

    rp.relativize_runs(runs, dry_run=False)
    first = (run / "manifest.json").read_text(encoding="utf-8")

    second_results = rp.relativize_runs(runs, dry_run=False)
    assert not second_results[0].changed
    assert second_results[0].files[0].skipped_reason is not None
    assert (run / "manifest.json").read_text(encoding="utf-8") == first


def test_dry_run_writes_nothing(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = write_run(runs / "run1")
    before = (run / "manifest.json").read_text(encoding="utf-8")

    results = rp.relativize_runs(runs, dry_run=True)

    assert results[0].changed
    assert not any(f.written for f in results[0].files)
    assert (run / "manifest.json").read_text(encoding="utf-8") == before


def test_cleared_tests_anchor_falls_back_when_manifest_already_relative(
    tmp_path: Path,
) -> None:
    # Manifest already rewritten (run_dir == "."), but cleared_tests still absolute:
    # the tool must still finish it using the recorded root's parent.
    run = tmp_path / "runs" / "run1"
    run.mkdir(parents=True)
    (run / "output").mkdir()
    (run / "manifest.json").write_text(
        json.dumps({"run_dir": "."}, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    (run / "output" / "cleared_tests.json").write_text(
        json.dumps({"root": f"{run}/input", "removed": []}, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    rp.relativize_runs(tmp_path / "runs", dry_run=False)

    assert read_cleared(run)["root"] == "input"


def test_residual_leak_is_detected_advisory_by_default_strict_fails(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = runs / "run1"
    # An unregistered absolute path under the run's home prefix survives relativization.
    write_run(run, extra_manifest={"surprise_path": str(run / "extra")})

    results = rp.relativize_runs(runs, dry_run=True)
    assert results[0].residual  # detected

    # Default: a leftover host path is advisory (warning), so a successful rewrite
    # is not failed by it.
    assert rp.main([str(runs)]) == 0

    # --strict turns the residual into a gate failure (fresh copy: anchor still absolute).
    runs2 = tmp_path / "runs2"
    run2 = runs2 / "run1"
    write_run(run2, extra_manifest={"surprise_path": str(run2 / "extra")})
    assert rp.main([str(runs2), "--strict"]) == 1


def test_already_relative_manifest_with_leak_is_audited(tmp_path: Path) -> None:
    # Mimics a freshly-generated run (run_dir already ".") that still carries an
    # absolute home path in a free-text/unregistered field. The audit must still
    # catch it via the current user's home prefix.
    run = tmp_path / "runs" / "run1"
    run.mkdir(parents=True)
    leak = str(Path.home() / "ga-eval-test-leak" / "x.txt")
    (run / "manifest.json").write_text(
        json.dumps(
            {"run_dir": ".", "staged_input": "input", "future_field": leak},
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    results = rp.relativize_runs(tmp_path / "runs", dry_run=True)
    assert any(value == leak for _, _, value in results[0].residual)
    assert rp.main([str(tmp_path / "runs")]) == 0  # advisory
    assert rp.main([str(tmp_path / "runs"), "--strict"]) == 1


def test_manifest_without_run_dir_uses_fallback_anchor(tmp_path: Path) -> None:
    run = tmp_path / "runs" / "run1"
    run.mkdir(parents=True)
    (run / "output").mkdir()
    base = run.parent
    (run / "manifest.json").write_text(
        json.dumps(
            {
                "staged_input": f"{run}/input",
                "output_dir": f"{run}/output",
                "input_dir": str(base / "resources" / "p"),
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    rp.relativize_runs(tmp_path / "runs", dry_run=False)

    manifest = read_manifest(run)
    assert manifest["staged_input"] == "input"
    assert manifest["output_dir"] == "output"
    assert manifest["input_dir"] == "../resources/p"


def test_free_text_home_path_is_preserved_and_does_not_fail(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = runs / "run1"
    leak = str(run / "shared" / "libs")
    write_run(run, extra_manifest={"agent_options": {"extra_args": ["--add-dir", leak]}})

    # The rewrite succeeds (run_dir -> "."), the free-text arg is preserved verbatim,
    # and a deliberately-kept home path does not fail the default exit code.
    assert rp.main([str(runs)]) == 0
    manifest = read_manifest(run)
    assert manifest["run_dir"] == "."
    assert manifest["agent_options"]["extra_args"] == ["--add-dir", leak]


def test_check_mode_gates_pending_changes(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = write_run(runs / "run1")
    before = (run / "manifest.json").read_text(encoding="utf-8")

    # --check never writes, and fails while changes are pending.
    assert rp.main([str(runs), "--check"]) == 1
    assert (run / "manifest.json").read_text(encoding="utf-8") == before

    # After applying, --check passes.
    assert rp.main([str(runs)]) == 0
    assert rp.main([str(runs), "--check"]) == 0


def test_invalid_json_is_reported_as_error(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = runs / "run1"
    run.mkdir(parents=True)
    (run / "manifest.json").write_text("{not json", encoding="utf-8")

    results = rp.relativize_runs(runs, dry_run=False)
    assert results[0].error is not None
    assert rp.main([str(runs)]) == 1


def test_main_succeeds_on_clean_runs(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    write_run(runs / "run1")
    write_run(runs / "run2", with_cleared_tests=False)

    assert rp.main([str(runs)]) == 0
    # Second invocation is a clean no-op.
    assert rp.main([str(runs)]) == 0


def test_empty_dir_errors(tmp_path: Path) -> None:
    (tmp_path / "empty").mkdir()
    with pytest.raises(rp.RelativizeError, match="no run directories"):
        rp.relativize_runs(tmp_path / "empty", dry_run=False)
