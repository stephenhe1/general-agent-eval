from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from general_agent_eval.general_agents import claude_code
from general_agent_eval.general_agents.agent_specs import build_claude_code_command
from general_agent_eval.orchestration import cli, docker, paths, preprocess, staging
from general_agent_eval.orchestration.errors import DockerRunError
from general_agent_eval.orchestration.run import build_agent_request
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

    request = build_agent_request(args)

    assert request.reset_git is False
    assert request.oauth_token_env == "CLAUDE_CODE_OAUTH_TOKEN"


def test_docker_passes_oauth_token_env_name_once() -> None:
    args = argparse.Namespace(
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env="CLAUDE_CODE_OAUTH_TOKEN",
    )

    assert cli.required_host_env_names(args) == ("CLAUDE_CODE_OAUTH_TOKEN",)


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

    command = build_claude_code_command(build_agent_request(args))

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


def test_claude_code_env_base_url_disables_experimental_betas() -> None:
    args = argparse.Namespace(
        env=[],
        base_url="http://localhost:4000",
        model="sonnet",
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env=None,
        api_key=None,
        auth_token=None,
        custom_header=[],
    )

    env = claude_code.build_agent_env(args)

    assert env["ANTHROPIC_BASE_URL"] == "http://localhost:4000"
    assert env["ANTHROPIC_CUSTOM_MODEL_OPTION"] == "sonnet"
    assert env["CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS"] == "1"


def test_claude_code_env_base_url_betas_override_wins() -> None:
    args = argparse.Namespace(
        env=["CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=0"],
        base_url="http://localhost:4000",
        model="sonnet",
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env=None,
        api_key=None,
        auth_token=None,
        custom_header=[],
    )

    env = claude_code.build_agent_env(args)

    assert env["CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS"] == "0"


def test_claude_code_env_no_base_url_omits_experimental_betas() -> None:
    args = argparse.Namespace(
        env=[],
        base_url=None,
        model="sonnet",
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env=None,
        api_key=None,
        auth_token=None,
        custom_header=[],
    )

    assert "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS" not in claude_code.build_agent_env(
        args
    )


@pytest.mark.parametrize(
    "removed_arg",
    [
        "--custom-header",
        "--agent-arg",
        "--system-mode",
        "--var",
    ],
)
def test_docker_parser_rejects_removed_forwarding_args(removed_arg: str) -> None:
    parser = cli.build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--input-dir", "/tmp/project", removed_arg, "value"])


def test_docker_parser_accepts_template_and_image_options() -> None:
    parser = cli.build_parser()
    args = parser.parse_args(
        [
            "--input-dir", "/tmp/project",
            "--system-template", "/tmp/system.jinja2",
            "--chat-template", "/tmp/chat.jinja2",
            "--prompt-var", "task=summarize",
            "--prompt-var", "depth=full",
            "--image", "custom:1.0",
            "--dockerfile", "/tmp/Dockerfile.custom",
        ]
    )
    assert args.system_template == Path("/tmp/system.jinja2")
    assert args.chat_template == Path("/tmp/chat.jinja2")
    assert args.prompt_var == ["task=summarize", "depth=full"]
    assert args.image == "custom:1.0"
    assert args.dockerfile == Path("/tmp/Dockerfile.custom")


def test_validate_agent_values_rejects_reserved_prompt_var() -> None:
    args = argparse.Namespace(env=[], prompt_var=["model=opus"])

    with pytest.raises(DockerRunError, match="reserved"):
        cli.validate_agent_values(args)


def test_validate_agent_values_rejects_malformed_prompt_var() -> None:
    args = argparse.Namespace(env=[], prompt_var=["novalue"])

    with pytest.raises(DockerRunError, match="KEY=VALUE"):
        cli.validate_agent_values(args)


def test_claude_code_parser_rejects_removed_var_arg() -> None:
    parser = claude_code.build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--input-dir", "/tmp/project", "--var", "task=value"])


def image_args(**overrides: object) -> argparse.Namespace:
    base: dict[str, object] = dict(image=None, dockerfile=None, skip_build=False)
    base.update(overrides)
    return argparse.Namespace(**base)


def test_build_image_plan_requires_docker_buildx(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(
        command: list[str],
        **kwargs: object,
    ) -> subprocess.CompletedProcess[str]:
        assert command == ["docker", "buildx", "version"]
        return subprocess.CompletedProcess(command, 1, "", "unknown command")

    monkeypatch.setattr(docker.subprocess, "run", fake_run)

    plan = docker.resolve_image_plan(image_args(), agent="claude-code")
    with pytest.raises(DockerRunError, match="Docker Buildx is required"):
        docker.build_image_plan(plan)


def test_build_image_plan_builds_each_layer_in_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    commands: list[list[str]] = []

    def fake_run(
        command: list[str],
        **kwargs: object,
    ) -> subprocess.CompletedProcess[str]:
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, "buildx version\n", "")

    monkeypatch.setattr(docker.subprocess, "run", fake_run)

    plan = docker.resolve_image_plan(image_args(), agent="claude-code")
    docker.build_image_plan(plan)

    assert commands[0] == ["docker", "buildx", "version"]
    # base -> claude-code -> java, each a `buildx build --load`.
    base_build = commands[1]
    assert base_build[:4] == ["docker", "buildx", "build", "--load"]
    assert base_build[base_build.index("-f") + 1] == str(docker.BASE_DOCKERFILE)
    assert base_build[base_build.index("-t") + 1] == docker.BASE_IMAGE
    assert base_build[-1] == str(docker.PROJECT_ROOT)

    agent_build = commands[2]
    assert agent_build[agent_build.index("-f") + 1] == str(
        docker.AGENT_DOCKERFILES["claude-code"]
    )
    # Overlays build FROM the previous layer's tag.
    assert f"BASE_IMAGE={docker.BASE_IMAGE}" in agent_build

    java_build = commands[3]
    assert java_build[java_build.index("-f") + 1] == str(docker.JAVA_DOCKERFILE)
    assert f"BASE_IMAGE={plan.layers[1].image}" in java_build


def test_build_image_plan_custom_dockerfile_uses_its_dir_as_context(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    dockerfile = tmp_path / "Dockerfile.custom"
    dockerfile.write_text("FROM scratch\n", encoding="utf-8")
    commands: list[list[str]] = []

    def fake_run(
        command: list[str],
        **kwargs: object,
    ) -> subprocess.CompletedProcess[str]:
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, "buildx version\n", "")

    monkeypatch.setattr(docker.subprocess, "run", fake_run)

    plan = docker.resolve_image_plan(
        image_args(dockerfile=dockerfile, image="custom:1.0"), agent="claude-code"
    )
    docker.build_image_plan(plan)

    build = commands[1]
    assert build[build.index("-f") + 1] == str(dockerfile.resolve())
    assert build[build.index("-t") + 1] == "custom:1.0"
    assert build[-1] == str(dockerfile.resolve().parent)


def test_resolve_image_plan_default_builds_layered_stack() -> None:
    plan = docker.resolve_image_plan(image_args(), agent="claude-code")

    assert plan.build is True
    assert [layer.name for layer in plan.layers] == ["base", "claude-code", "java"]
    assert plan.layers[0].dockerfile == docker.BASE_DOCKERFILE
    assert plan.layers[0].image == docker.BASE_IMAGE
    # The run image is the final layer's tag.
    assert plan.image == plan.layers[-1].image
    assert plan.image == "general-agent-eval-claude-code-java:latest"


def test_resolve_image_plan_adds_genome_nexus_overlay() -> None:
    plan = docker.resolve_image_plan(
        image_args(), agent="claude-code", service={"id": "genome-nexus"}
    )

    assert [layer.name for layer in plan.layers] == [
        "base",
        "claude-code",
        "java",
        "genome-nexus",
    ]
    assert plan.image == "general-agent-eval-claude-code-java-genome-nexus:latest"


def test_resolve_image_plan_other_service_has_no_overlay() -> None:
    plan = docker.resolve_image_plan(
        image_args(), agent="codex", service={"id": "restcountries"}
    )

    assert [layer.name for layer in plan.layers] == ["base", "codex", "java"]


def test_resolve_image_plan_skip_build_runs_stack_tip_without_building() -> None:
    plan = docker.resolve_image_plan(image_args(skip_build=True), agent="claude-code")

    assert plan.build is False
    assert plan.layers == ()
    # The image is the tag a full build would have produced.
    built = docker.resolve_image_plan(image_args(), agent="claude-code")
    assert plan.image == built.image


def test_resolve_image_plan_image_alone_runs_prebuilt() -> None:
    plan = docker.resolve_image_plan(image_args(image="custom:1.0"), agent="claude-code")

    assert plan.image == "custom:1.0"
    assert plan.build is False
    assert plan.layers == ()


def test_resolve_image_plan_dockerfile_builds_default_tag(tmp_path: Path) -> None:
    dockerfile = tmp_path / "Dockerfile.custom"
    dockerfile.write_text("FROM scratch\n", encoding="utf-8")

    plan = docker.resolve_image_plan(
        image_args(dockerfile=dockerfile), agent="claude-code"
    )

    assert plan.image == docker.DEFAULT_IMAGE
    assert [layer.name for layer in plan.layers] == ["custom"]
    assert plan.layers[0].dockerfile == dockerfile.resolve()
    assert plan.layers[0].context == dockerfile.resolve().parent


def test_resolve_image_plan_dockerfile_with_image_builds_custom_tag(
    tmp_path: Path,
) -> None:
    dockerfile = tmp_path / "Dockerfile.custom"
    dockerfile.write_text("FROM scratch\n", encoding="utf-8")

    plan = docker.resolve_image_plan(
        image_args(dockerfile=dockerfile, image="custom:1.0"), agent="claude-code"
    )

    assert plan.image == "custom:1.0"
    assert plan.layers[0].image == "custom:1.0"
    assert plan.layers[0].name == "custom"


def test_resolve_image_plan_rejects_skip_build_with_dockerfile(
    tmp_path: Path,
) -> None:
    dockerfile = tmp_path / "Dockerfile.custom"
    dockerfile.write_text("FROM scratch\n", encoding="utf-8")

    with pytest.raises(DockerRunError, match="conflicts"):
        docker.resolve_image_plan(
            image_args(dockerfile=dockerfile, skip_build=True), agent="claude-code"
        )


def test_resolve_image_plan_rejects_missing_dockerfile(tmp_path: Path) -> None:
    with pytest.raises(DockerRunError, match="not a file"):
        docker.resolve_image_plan(
            image_args(dockerfile=tmp_path / "missing"), agent="claude-code"
        )


def test_resolve_image_plan_requires_source_checkout_for_build(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # Simulate an installed wheel: PROJECT_ROOT has no docker/ Dockerfiles.
    monkeypatch.setattr(
        docker, "BASE_DOCKERFILE", tmp_path / "docker" / "Dockerfile.base"
    )

    with pytest.raises(DockerRunError, match="source checkout"):
        docker.resolve_image_plan(image_args(), agent="claude-code")

    # --skip-build only needs the final tag, so it must not require the Dockerfiles.
    plan = docker.resolve_image_plan(image_args(skip_build=True), agent="claude-code")
    assert plan.build is False
    assert plan.image == "general-agent-eval-claude-code-java:latest"


def template_args(**overrides: object) -> argparse.Namespace:
    base: dict[str, object] = dict(system_template=None, chat_template=None)
    base.update(overrides)
    return argparse.Namespace(**base)


def test_resolve_template_mounts_empty_without_overrides() -> None:
    assert docker.resolve_template_mounts(template_args()) == ()


def test_resolve_template_mounts_maps_container_paths(tmp_path: Path) -> None:
    system = tmp_path / "sys" / "system.jinja2"
    chat = tmp_path / "chat" / "chat.jinja2"
    write_file(system, "system prompt")
    write_file(chat, "chat prompt")

    mounts = docker.resolve_template_mounts(
        template_args(system_template=system, chat_template=chat)
    )

    assert [mount.role for mount in mounts] == ["system", "chat"]
    assert mounts[0].host_path == system
    assert mounts[0].container_path == (
        f"{docker.CONTAINER_TEMPLATES_DIR}/system/system.jinja2"
    )
    assert mounts[1].container_dir == f"{docker.CONTAINER_TEMPLATES_DIR}/chat"


def test_resolve_template_mounts_rejects_missing_template(tmp_path: Path) -> None:
    with pytest.raises(DockerRunError, match="--system-template"):
        docker.resolve_template_mounts(
            template_args(system_template=tmp_path / "missing.jinja2")
        )


def test_build_agent_request_forwards_templates_and_prompt_vars(
    tmp_path: Path,
) -> None:
    system = tmp_path / "system.jinja2"
    system.write_text("system prompt", encoding="utf-8")
    args = argparse.Namespace(
        model="sonnet",
        permission_mode="auto",
        system_prompt_config="append",
        base_url=None,
        api_key_env=None,
        auth_token_env=None,
        oauth_token_env=None,
        max_turns=None,
        max_budget_usd=None,
        reset_git=False,
        env=[],
        extra_arg=[],
        prompt_var=["task=summarize"],
        system_template=system,
        chat_template=None,
    )
    mounts = docker.resolve_template_mounts(args)

    request = build_agent_request(args, None, mounts)
    command = build_claude_code_command(request)

    assert request.system_template == (
        f"{docker.CONTAINER_TEMPLATES_DIR}/system/system.jinja2"
    )
    assert request.chat_template is None
    assert "task=summarize" in request.prompt_vars
    assert command[command.index("--system-template") + 1] == request.system_template
    assert "--chat-template" not in command


def test_prepare_run_dir_creates_generated_child_under_output_root(
    tmp_path: Path,
) -> None:
    input_dir = tmp_path / "sample-project"
    output_root = tmp_path / "runs"
    input_dir.mkdir()
    run_dir = output_root / staging.build_run_id(
        input_dir=input_dir,
        agent_name="claude-code",
    )

    staging.prepare_run_dir(run_dir, input_dir=input_dir)

    assert run_dir.parent == output_root
    assert run_dir.name.endswith("__claude-code__sample-project")
    assert run_dir.is_dir()


def test_default_output_root_is_project_runs(tmp_path: Path) -> None:
    input_dir = tmp_path / "sample-project"
    input_dir.mkdir()

    assert staging.default_output_root(input_dir=input_dir) == (
        paths.PROJECT_ROOT / "runs"
    )


def test_run_id_uses_unique_field_delimiter(tmp_path: Path) -> None:
    input_dir = tmp_path / "sample_project"
    input_dir.mkdir()

    run_id = staging.build_run_id(
        input_dir=input_dir,
        agent_name="claude-code",
    )

    parts = run_id.split(staging.RUN_ID_DELIMITER)
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

    with pytest.raises(DockerRunError, match="already exists"):
        staging.prepare_run_dir(run_dir, input_dir=input_dir)

    assert marker.read_text(encoding="utf-8") == "keep\n"


def test_prepare_run_dir_rejects_output_root_inside_input_dir(
    tmp_path: Path,
) -> None:
    input_dir = tmp_path / "sample-project"
    input_dir.mkdir()
    run_dir = (
        input_dir
        / "runs"
        / staging.build_run_id(
            input_dir=input_dir,
            agent_name="claude-code",
        )
    )

    with pytest.raises(DockerRunError, match="must not be inside"):
        staging.prepare_run_dir(run_dir, input_dir=input_dir)


def test_clear_tests_sanitizes_history_and_preserves_patch_sequence(
    tmp_path: Path,
) -> None:
    staged_repo = tmp_path / "staged"
    apply_repo = tmp_path / "apply"
    output_dir = tmp_path / "output"
    init_repo(staged_repo)
    shutil.copytree(staged_repo, apply_repo)
    output_dir.mkdir()

    preprocessing = preprocess.preprocess_staged_input(
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
    staging.collect_git_artifacts(staged_repo, output_dir)
    assert "class AppTest { void generated() {} }" in (
        output_dir / "git_diff.patch"
    ).read_text(encoding="utf-8")

    run(["git", "apply", str(output_dir / "test_clearing.patch")], cwd=apply_repo)
    run(["git", "apply", str(output_dir / "git_diff.patch")], cwd=apply_repo)
    assert "generated" in (apply_repo / "src/test/java/example/AppTest.java").read_text(
        encoding="utf-8"
    )


POM_WITH_DEPS = """<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <artifactId>demo</artifactId>
  <dependencies>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
"""


def init_repo_with_pom(repo: Path) -> None:
    repo.mkdir()
    write_file(repo / "pom.xml", POM_WITH_DEPS)
    write_file(repo / "src/main/java/example/App.java", "class App {}\n")
    write_file(repo / "src/test/java/example/AppTest.java", "class AppTest {}\n")
    run(["git", "init"], cwd=repo)
    configure_git(repo)
    commit_all(repo, "initial")


def test_inject_rest_assured_lands_in_baseline_not_agent_diff(tmp_path: Path) -> None:
    staged = tmp_path / "staged"
    output_dir = tmp_path / "output"
    init_repo_with_pom(staged)
    output_dir.mkdir()
    service = {
        "id": "demo",
        "rest_assured": {
            "target_pom": "pom.xml",
            "group_id": "io.rest-assured",
            "artifact_id": "rest-assured",
            "version": "5.5.0",
            "scope": "test",
        },
    }

    preprocessing = preprocess.preprocess_staged_input(
        args=argparse.Namespace(
            reset_git=False, clear_tests=True, inject_rest_assured=True
        ),
        staged_input=staged,
        output_dir=output_dir,
        service=service,
    )

    injection = preprocessing["rest_assured_injection"]
    assert injection["status"] == "injected"
    assert injection["managed"] is False
    # The dependency is committed into the testless baseline.
    assert "io.rest-assured" in (staged / "pom.xml").read_text(encoding="utf-8")
    patch = (output_dir / "dependency_injection.patch").read_text(encoding="utf-8")
    assert "io.rest-assured" in patch and "pom.xml" in patch

    # The agent adds a test; the resulting agent diff must not include the POM edit.
    write_file(staged / "src/test/java/example/ApiIT.java", "class ApiIT {}\n")
    staging.collect_git_artifacts(staged, output_dir)
    diff = (output_dir / "git_diff.patch").read_text(encoding="utf-8")
    assert "ApiIT.java" in diff
    assert "pom.xml" not in diff


def test_inject_rest_assured_skipped_when_service_lacks_config(tmp_path: Path) -> None:
    staged = tmp_path / "staged"
    output_dir = tmp_path / "output"
    init_repo_with_pom(staged)
    output_dir.mkdir()

    preprocessing = preprocess.preprocess_staged_input(
        args=argparse.Namespace(
            reset_git=False, clear_tests=False, inject_rest_assured=True
        ),
        staged_input=staged,
        output_dir=output_dir,
        service={"id": "features-service"},  # no rest_assured block
    )

    injection = preprocessing["rest_assured_injection"]
    assert injection["status"] == "skipped"
    assert "rest-assured" not in (staged / "pom.xml").read_text(encoding="utf-8")
    assert not (output_dir / "dependency_injection.patch").exists()


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
    staging.stage_input(submodule, staged_input)

    assert git_output(["rev-parse", "HEAD"], cwd=staged_input) == commit_b

    preprocessing = preprocess.preprocess_staged_input(
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
