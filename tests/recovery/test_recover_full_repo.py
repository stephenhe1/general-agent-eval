from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path
from typing import Callable

import pytest

from general_agent_eval.general_agents import docker_run
from general_agent_eval.recovery import recover_full_repo


def run(command: list[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=cwd,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    return result


def write_file(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def configure_git(repo: Path) -> None:
    run(["git", "config", "user.name", "Test User"], cwd=repo)
    run(["git", "config", "user.email", "test@example.invalid"], cwd=repo)


def init_origin(repo: Path) -> str:
    repo.mkdir()
    write_file(repo / "pom.xml", "<project></project>\n")
    write_file(repo / "src/main/java/example/App.java", "class App {}\n")
    write_file(repo / "src/test/java/example/AppTest.java", "class AppTest {}\n")
    write_file(
        repo / "src/test/java/example/UntouchedTest.java", "class UntouchedTest {}\n"
    )
    run(["git", "init"], cwd=repo)
    configure_git(repo)
    run(["git", "add", "--all"], cwd=repo)
    run(["git", "commit", "-m", "initial"], cwd=repo)
    return run(["git", "rev-parse", "HEAD"], cwd=repo).stdout.strip()


def make_run(
    tmp_path: Path, agent_edits: Callable[[Path], None]
) -> tuple[Path, Path, str]:
    """Build an origin repo and a faithful run dir, applying agent_edits before diffing."""
    if shutil.which("rsync") is None:
        pytest.skip("rsync is required by Docker staging")

    origin = tmp_path / "origin"
    origin_head = init_origin(origin)

    run_dir = tmp_path / "run"
    staged = run_dir / "input"
    output_dir = run_dir / "output"
    run_dir.mkdir()
    output_dir.mkdir()

    docker_run.stage_input(origin, staged)
    preprocessing = docker_run.preprocess_staged_input(
        args=argparse.Namespace(reset_git=False, clear_tests=True),
        staged_input=staged,
        output_dir=output_dir,
    )
    agent_edits(staged)
    docker_run.collect_git_artifacts(staged, output_dir)

    (run_dir / "manifest.json").write_text(
        json.dumps({"input_dir": str(origin), "preprocessing": preprocessing}),
        encoding="utf-8",
    )
    return origin, run_dir, origin_head


def recover(tmp_path: Path, origin: Path, run_dir: Path) -> dict:
    args = argparse.Namespace(
        run_dir=run_dir,
        repo_url=str(origin),
        commit=None,
        output_dir=tmp_path / "recovered",
    )
    return recover_full_repo.recover(args)


def test_recover_merges_agent_tests_into_full_repo(tmp_path: Path) -> None:
    def agent_edits(staged: Path) -> None:
        write_file(
            staged / "src/test/java/example/AppTest.java",
            "class AppTest { void generated() {} }\n",
        )
        write_file(
            staged / "src/test/java/example/GeneratedApiTest.java",
            "class GeneratedApiTest {}\n",
        )

    origin, run_dir, origin_head = make_run(tmp_path, agent_edits)
    manifest = recover(tmp_path, origin, run_dir)

    repo_dir = Path(manifest["repo_dir"])
    assert manifest["apply_status"] == "clean"
    assert manifest["commit"] == origin_head
    assert manifest["commit_source"] == "test_clearing.git_baseline.original_head"

    # Full repository structure is preserved.
    assert (repo_dir / "pom.xml").exists()
    assert (repo_dir / "src/main/java/example/App.java").exists()
    # An original test the agent never touched survives the recovery.
    assert (repo_dir / "src/test/java/example/UntouchedTest.java").exists()
    # The agent's brand-new test is merged in.
    assert (repo_dir / "src/test/java/example/GeneratedApiTest.java").exists()
    # Agent wins the collision at the recreated path.
    assert "generated" in (
        repo_dir / "src/test/java/example/AppTest.java"
    ).read_text(encoding="utf-8")

    collisions = {c["path"]: c for c in manifest["collisions"]}
    assert "src/test/java/example/AppTest.java" in collisions
    assert collisions["src/test/java/example/AppTest.java"]["expected_cleared"] is True
    assert manifest["counts"]["non_test_touched"] == 0


def test_recover_flags_production_code_changes(tmp_path: Path) -> None:
    def agent_edits(staged: Path) -> None:
        write_file(
            staged / "src/test/java/example/GeneratedApiTest.java",
            "class GeneratedApiTest {}\n",
        )
        # The prompt forbids this; recovery must surface it rather than hide it.
        write_file(
            staged / "src/main/java/example/App.java", "class App { int x; }\n"
        )

    origin, run_dir, _ = make_run(tmp_path, agent_edits)
    manifest = recover(tmp_path, origin, run_dir)

    assert manifest["apply_status"] == "clean"
    non_test = {item["path"]: item["classification"] for item in manifest["non_test_touched"]}
    assert non_test.get("src/main/java/example/App.java") == "production"


def test_recover_rejects_missing_patch(tmp_path: Path) -> None:
    run_dir = tmp_path / "run"
    (run_dir / "output").mkdir(parents=True)
    (run_dir / "manifest.json").write_text("{}", encoding="utf-8")

    args = argparse.Namespace(
        run_dir=run_dir, repo_url="https://example.invalid/x.git", commit=None, output_dir=None
    )
    with pytest.raises(recover_full_repo.RecoverError, match="missing the agent patch"):
        recover_full_repo.recover(args)


def test_resolve_commit_prefers_pinned_commit() -> None:
    manifest = {
        "preprocessing": {
            "reset_git": {"enabled": True, "pinned_commit": "abc123"},
            "test_clearing": {"git_baseline": {"original_head": "def456"}},
        }
    }
    info = recover_full_repo.resolve_commit(manifest, None)
    assert info == {"commit": "abc123", "source": "reset_git.pinned_commit"}


def test_resolve_commit_override_wins() -> None:
    info = recover_full_repo.resolve_commit({}, "deadbeef")
    assert info == {"commit": "deadbeef", "source": "override"}


def test_classify_path() -> None:
    assert recover_full_repo.classify_path("src/test/java/example/FooTest.java") == "test"
    assert recover_full_repo.classify_path("src/it/java/example/BarIT.java") == "test"
    assert recover_full_repo.classify_path("pom.xml") == "build"
    assert recover_full_repo.classify_path("service/build.gradle") == "build"
    assert recover_full_repo.classify_path("src/main/java/example/App.java") == "production"


def test_parse_apply_summary_and_numstat() -> None:
    summary = recover_full_repo.parse_apply_summary(
        " create mode 100644 src/test/java/A.java\n"
        " delete mode 100644 src/test/java/B.java\n"
    )
    assert summary["created"] == ["src/test/java/A.java"]
    assert summary["deleted"] == ["src/test/java/B.java"]

    paths = recover_full_repo.parse_numstat(
        "3\t0\tsrc/test/java/A.java\n-\t-\tassets/logo.png\n"
    )
    assert paths == ["src/test/java/A.java", "assets/logo.png"]
