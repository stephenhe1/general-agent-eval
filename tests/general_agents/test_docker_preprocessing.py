from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from general_agent_eval.general_agents import claude_code
from general_agent_eval.general_agents import docker_run
from general_agent_eval.general_agents.agent_specs import build_claude_code_command
from general_agent_eval.preprocessing.git_reset import resolve_reset_target


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


def git_output(git_args: list[str], *, cwd: Path) -> str:
    return run(["git", *git_args], cwd=cwd).stdout.strip()


def write_file(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def configure_git(repo: Path) -> None:
    run(["git", "config", "user.name", "Test User"], cwd=repo)
    run(["git", "config", "user.email", "test@example.invalid"], cwd=repo)


def commit_all(repo: Path, message: str) -> str:
    run(["git", "add", "--all"], cwd=repo)
    run(["git", "commit", "-m", message], cwd=repo)
    return git_output(["rev-parse", "HEAD"], cwd=repo)


def init_repo(repo: Path) -> None:
    repo.mkdir()
    write_file(repo / "src/main/java/example/App.java", "class App {}\n")
    write_file(repo / "src/test/java/example/AppTest.java", "class AppTest {}\n")
    run(["git", "init"], cwd=repo)
    configure_git(repo)
    commit_all(repo, "initial")


def test_build_agent_request_does_not_forward_reset_git() -> None:
    args = argparse.Namespace(
        model="sonnet",
        permission_mode="auto",
        system_prompt_config="append",
        base_url=None,
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env="CLAUDE_CODE_OAUTH_TOKEN",
        max_turns=None,
        max_budget_usd=None,
        reset_git=True,
        env=[],
        extra_arg=[],
    )

    request = docker_run.build_agent_request(args)

    assert request.reset_git is False
    assert request.oauth_token_env == "CLAUDE_CODE_OAUTH_TOKEN"


def test_docker_passes_oauth_token_env_name_once() -> None:
    args = argparse.Namespace(
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env="CLAUDE_CODE_OAUTH_TOKEN",
    )

    assert docker_run.required_host_env_names(args) == ("CLAUDE_CODE_OAUTH_TOKEN",)


def test_claude_code_command_forwards_oauth_token_env() -> None:
    args = argparse.Namespace(
        model="sonnet",
        permission_mode="auto",
        system_prompt_config="append",
        base_url=None,
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env="CLAUDE_CODE_OAUTH_TOKEN",
        max_turns=None,
        max_budget_usd=None,
        reset_git=False,
        env=[],
        extra_arg=[],
    )

    command = build_claude_code_command(docker_run.build_agent_request(args))

    assert "--system-prompt-config" in command
    assert "--system-mode" not in command
    assert "--oauth-token-env" in command
    assert command[command.index("--oauth-token-env") + 1] == "CLAUDE_CODE_OAUTH_TOKEN"


def test_claude_code_env_maps_oauth_token_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("HOST_CLAUDE_OAUTH", "oauth-token")
    args = argparse.Namespace(
        env=[],
        base_url=None,
        model="sonnet",
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env="HOST_CLAUDE_OAUTH",
        api_key=None,
        auth_token=None,
        custom_header=[],
    )

    assert claude_code.build_agent_env(args) == {
        "CLAUDE_CODE_OAUTH_TOKEN": "oauth-token"
    }


@pytest.mark.parametrize(
    "removed_arg",
    [
        "--custom-header",
        "--agent-arg",
        "--image",
        "--dockerfile",
        "--system-mode",
        "--var",
    ],
)
def test_docker_parser_rejects_removed_forwarding_args(removed_arg: str) -> None:
    parser = docker_run.build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--input-dir", "/tmp/project", removed_arg, "value"])


def test_claude_code_parser_rejects_removed_var_arg() -> None:
    parser = claude_code.build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--input-dir", "/tmp/project", "--var", "task=value"])


def test_build_image_requires_docker_buildx(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(
        command: list[str],
        **kwargs: object,
    ) -> subprocess.CompletedProcess[str]:
        assert command == ["docker", "buildx", "version"]
        return subprocess.CompletedProcess(command, 1, "", "unknown command")

    monkeypatch.setattr(docker_run.subprocess, "run", fake_run)

    with pytest.raises(docker_run.DockerRunError, match="Docker Buildx is required"):
        docker_run.build_image()


def test_build_image_uses_buildx_load(monkeypatch: pytest.MonkeyPatch) -> None:
    commands: list[list[str]] = []

    def fake_run(
        command: list[str],
        **kwargs: object,
    ) -> subprocess.CompletedProcess[str]:
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, "buildx version\n", "")

    monkeypatch.setattr(docker_run.subprocess, "run", fake_run)

    docker_run.build_image()

    assert commands[0] == ["docker", "buildx", "version"]
    assert commands[1][:4] == ["docker", "buildx", "build", "--load"]
    assert commands[1][commands[1].index("-f") + 1] == str(
        docker_run.DEFAULT_DOCKERFILE
    )
    assert commands[1][commands[1].index("-t") + 1] == docker_run.DEFAULT_IMAGE


def test_prepare_run_dir_creates_generated_child_under_output_root(
    tmp_path: Path,
) -> None:
    input_dir = tmp_path / "sample-project"
    output_root = tmp_path / "runs"
    input_dir.mkdir()
    run_dir = output_root / docker_run.build_run_id(
        input_dir=input_dir,
        agent_name="claude-code",
    )

    docker_run.prepare_run_dir(run_dir, input_dir=input_dir)

    assert run_dir.parent == output_root
    assert run_dir.name.endswith("__claude-code__sample-project")
    assert run_dir.is_dir()


def test_default_output_root_is_project_runs(tmp_path: Path) -> None:
    input_dir = tmp_path / "sample-project"
    input_dir.mkdir()

    assert docker_run.default_output_root(input_dir=input_dir) == (
        docker_run.PROJECT_ROOT / "runs"
    )


def test_run_id_uses_unique_field_delimiter(tmp_path: Path) -> None:
    input_dir = tmp_path / "sample_project"
    input_dir.mkdir()

    run_id = docker_run.build_run_id(
        input_dir=input_dir,
        agent_name="claude-code",
    )

    parts = run_id.split(docker_run.RUN_ID_DELIMITER)
    assert len(parts) == 3
    assert parts[1] == "claude-code"
    assert parts[2] == "sample-project"


def test_prepare_run_dir_rejects_existing_run_dir_without_deleting(
    tmp_path: Path,
) -> None:
    input_dir = tmp_path / "sample-project"
    run_dir = tmp_path / "runs" / "existing-run"
    input_dir.mkdir()
    run_dir.mkdir(parents=True)
    marker = run_dir / "marker.txt"
    marker.write_text("keep\n", encoding="utf-8")

    with pytest.raises(docker_run.DockerRunError, match="already exists"):
        docker_run.prepare_run_dir(run_dir, input_dir=input_dir)

    assert marker.read_text(encoding="utf-8") == "keep\n"


def test_prepare_run_dir_rejects_output_root_inside_input_dir(
    tmp_path: Path,
) -> None:
    input_dir = tmp_path / "sample-project"
    input_dir.mkdir()
    run_dir = (
        input_dir
        / "runs"
        / docker_run.build_run_id(
            input_dir=input_dir,
            agent_name="claude-code",
        )
    )

    with pytest.raises(docker_run.DockerRunError, match="must not be inside"):
        docker_run.prepare_run_dir(run_dir, input_dir=input_dir)


def test_clear_tests_sanitizes_history_and_preserves_patch_sequence(
    tmp_path: Path,
) -> None:
    staged_repo = tmp_path / "staged"
    apply_repo = tmp_path / "apply"
    output_dir = tmp_path / "output"
    init_repo(staged_repo)
    shutil.copytree(staged_repo, apply_repo)
    output_dir.mkdir()

    preprocessing = docker_run.preprocess_staged_input(
        args=argparse.Namespace(reset_git=False, clear_tests=True),
        staged_input=staged_repo,
        output_dir=output_dir,
    )

    assert preprocessing["test_clearing"]["removed_count"] == 1
    assert not (staged_repo / "src/test").exists()
    clearing_manifest = json.loads(
        (output_dir / "cleared_tests.json").read_text(encoding="utf-8")
    )
    assert clearing_manifest["removed_count"] == 1
    assert clearing_manifest["preserved_suspicious_count"] == 0
    assert "src/test/java/example/AppTest.java" in (
        output_dir / "test_clearing.patch"
    ).read_text(encoding="utf-8")

    history_lookup = subprocess.run(
        ["git", "show", "HEAD:src/test/java/example/AppTest.java"],
        cwd=staged_repo,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert history_lookup.returncode != 0

    write_file(
        staged_repo / "src/test/java/example/AppTest.java",
        "class AppTest { void generated() {} }\n",
    )
    docker_run.collect_git_artifacts(staged_repo, output_dir)
    assert "class AppTest { void generated() {} }" in (
        output_dir / "git_diff.patch"
    ).read_text(encoding="utf-8")

    run(["git", "apply", str(output_dir / "test_clearing.patch")], cwd=apply_repo)
    run(["git", "apply", str(output_dir / "git_diff.patch")], cwd=apply_repo)
    assert "generated" in (apply_repo / "src/test/java/example/AppTest.java").read_text(
        encoding="utf-8"
    )


def test_reset_git_uses_source_superproject_pin_after_staging(tmp_path: Path) -> None:
    if shutil.which("rsync") is None:
        pytest.skip("rsync is required by Docker staging")

    module_source = tmp_path / "module-source"
    module_source.mkdir()
    run(["git", "init"], cwd=module_source)
    configure_git(module_source)
    write_file(module_source / "src/main/java/example/App.java", "class AppA {}\n")
    commit_a = commit_all(module_source, "commit a")
    write_file(module_source / "src/main/java/example/App.java", "class AppB {}\n")
    commit_b = commit_all(module_source, "commit b")

    superproject = tmp_path / "superproject"
    superproject.mkdir()
    run(["git", "init"], cwd=superproject)
    configure_git(superproject)
    run(
        [
            "git",
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            str(module_source),
            "vendor/module",
        ],
        cwd=superproject,
    )
    submodule = superproject / "vendor/module"
    run(["git", "checkout", commit_a], cwd=submodule)
    commit_all(superproject, "pin module to commit a")

    run(["git", "checkout", commit_b], cwd=submodule)
    reset_target = resolve_reset_target(submodule)
    assert reset_target.pinned_commit == commit_a

    staged_input = tmp_path / "staged"
    output_dir = tmp_path / "output"
    output_dir.mkdir()
    docker_run.stage_input(submodule, staged_input)

    assert git_output(["rev-parse", "HEAD"], cwd=staged_input) == commit_b

    preprocessing = docker_run.preprocess_staged_input(
        args=argparse.Namespace(reset_git=True, clear_tests=False),
        staged_input=staged_input,
        output_dir=output_dir,
        reset_target=reset_target,
    )

    assert git_output(["rev-parse", "HEAD"], cwd=staged_input) == commit_a
    assert (staged_input / "src/main/java/example/App.java").read_text(
        encoding="utf-8"
    ) == "class AppA {}\n"
    assert preprocessing["reset_git"]["pinned_commit"] == commit_a
    assert preprocessing["reset_git"]["source_repo_root"] == str(submodule)
    assert preprocessing["reset_git"]["superproject_root"] == str(superproject)
    assert preprocessing["reset_git"]["superproject_relative_path"] == "vendor/module"
