from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING, Any

from general_agent_eval.general_agents.agent_specs import (
    AGENT_SPECS,
    AgentRunRequest,
)
from general_agent_eval.general_agents.claude_code import (
    DEFAULT_PERMISSION_MODE,
    PERMISSION_MODES,
)

if TYPE_CHECKING:
    from general_agent_eval.preprocessing.git_reset import GitResetTarget

MODULE_DIR = Path(__file__).resolve().parent
PACKAGE_DIR = MODULE_DIR.parent
PROJECT_ROOT = (
    PACKAGE_DIR.parent.parent if PACKAGE_DIR.parent.name == "src" else Path.cwd()
).resolve()

DEFAULT_DOCKERFILE = MODULE_DIR / "Dockerfile.agent-runtime"
DEFAULT_IMAGE = "general-agent-eval-agent:latest"
CONTAINER_APP_DIR = "/app"
CONTAINER_INPUT_DIR = "/workspace/input"
CONTAINER_OUTPUT_DIR = "/workspace/output"
CONTAINER_SERVICE_SCRIPTS_DIR = "/workspace/service-scripts"
RUN_ID_DELIMITER = "__"
AGENT_RESULT_SUMMARY_KEYS = (
    "type",
    "subtype",
    "is_error",
    "duration_ms",
    "duration_api_ms",
    "num_turns",
    "total_cost_usd",
    "session_id",
    # Error context copied straight from the agent's result message when present.
    "stop_reason",
    "api_error_status",
    "errors",
)

# Qualifies total_cost_usd when a custom --base-url makes it a CLI estimate.
COST_ESTIMATE_NOTE = (
    "total_cost_usd is computed by the Claude Code CLI from token counts using "
    "its built-in Anthropic model price table. A custom --base-url was used "
    "(non-Anthropic gateway, e.g. OpenRouter), so for a non-Anthropic model the "
    "CLI falls back to default Anthropic rates and this figure is an estimate "
    "that may not match the gateway's actual billed cost. Check the provider's "
    "dashboard/usage API for the real cost."
)


class DockerRunError(RuntimeError):
    pass


def positive_int(raw_value: str) -> int:
    value = int(raw_value)
    if value <= 0:
        raise argparse.ArgumentTypeError("value must be greater than zero")
    return value


def positive_float(raw_value: str) -> float:
    value = float(raw_value)
    if value <= 0:
        raise argparse.ArgumentTypeError("value must be greater than zero")
    return value


def parse_key_value_key(raw_value: str, *, option_name: str) -> str:
    if "=" not in raw_value:
        raise DockerRunError(f"{option_name} values must use KEY=VALUE format")
    key = raw_value.split("=", 1)[0].strip()
    if not key:
        raise DockerRunError(f"{option_name} key cannot be empty")
    return key


def slugify(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9.-]+", "-", value.strip()).strip("-")
    return slug or "project"


def is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True


def build_run_id(*, input_dir: Path, agent_name: str) -> str:
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%S.%fZ")
    return RUN_ID_DELIMITER.join([stamp, slugify(agent_name), slugify(input_dir.name)])


def default_output_root(*, input_dir: Path) -> Path:
    base_dir = PROJECT_ROOT / "runs"
    if is_relative_to(base_dir, input_dir):
        base_dir = Path(tempfile.gettempdir()) / "general-agent-eval-runs"
    return base_dir


def run_checked(command: list[str], *, cwd: Path | None = None) -> str:
    result = subprocess.run(
        command,
        cwd=cwd,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise DockerRunError(f"Command failed: {command[0]}\n{detail}")
    return result.stdout


def git_repo_root(directory: Path) -> Path | None:
    result = subprocess.run(
        ["git", "-C", str(directory), "rev-parse", "--show-toplevel"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        return None
    return Path(result.stdout.strip()).resolve()


def prepare_run_dir(run_dir: Path, *, input_dir: Path) -> None:
    output_root = run_dir.parent
    if is_relative_to(output_root, input_dir):
        raise DockerRunError(
            "--output-dir must not be inside --input-dir; it would be copied "
            "into the agent workspace"
        )
    if output_root.exists() and not output_root.is_dir():
        raise DockerRunError(f"--output-dir is not a directory: {output_root}")
    if run_dir.exists():
        raise DockerRunError(f"Run directory already exists: {run_dir}")
    run_dir.mkdir(parents=True)


def sync_worktree(source: Path, destination: Path) -> None:
    if shutil.which("rsync") is None:
        raise DockerRunError(
            "rsync is required to stage Git worktrees while preserving cloned "
            "Git metadata"
        )
    run_checked(
        [
            "rsync",
            "-a",
            "--checksum",
            "--delete",
            "--exclude",
            ".git",
            f"{source}/",
            f"{destination}/",
        ]
    )


def stage_input(source: Path, destination: Path) -> str:
    repo_root = git_repo_root(source)
    if repo_root == source:
        run_checked(
            [
                "git",
                "clone",
                "--local",
                "--no-hardlinks",
                str(source),
                str(destination),
            ]
        )
        sync_worktree(source, destination)
        return "git-clone-rsync"

    shutil.copytree(source, destination, symlinks=True)
    return "copytree"


def git_output(directory: Path, git_args: list[str]) -> str:
    return run_checked(["git", "-C", str(directory), *git_args]).strip()


def write_git_patch(
    *,
    staged_input: Path,
    output_path: Path,
    relative_paths: list[str],
) -> None:
    if not relative_paths:
        output_path.write_text("", encoding="utf-8")
        return

    result = subprocess.run(
        [
            "git",
            "-C",
            str(staged_input),
            "diff",
            "--binary",
            "--",
            *relative_paths,
        ],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise DockerRunError(f"Failed to write Git patch: {detail}")
    output_path.write_text(result.stdout, encoding="utf-8")


def remove_git_metadata(root: Path) -> None:
    for current_dir, dir_names, file_names in os.walk(root, topdown=True):
        current_path = Path(current_dir)
        if ".git" in dir_names:
            git_path = current_path / ".git"
            if git_path.is_symlink() or git_path.is_file():
                git_path.unlink()
            else:
                shutil.rmtree(git_path)
            dir_names.remove(".git")
        if ".git" in file_names:
            (current_path / ".git").unlink()


def initialize_synthetic_git_baseline(staged_input: Path) -> dict[str, str | None]:
    original_head = None
    original_branch = None
    if git_repo_root(staged_input) == staged_input:
        original_head = git_output(staged_input, ["rev-parse", "HEAD"])
        original_branch = git_output(staged_input, ["branch", "--show-current"]) or None

    remove_git_metadata(staged_input)
    run_checked(["git", "init"], cwd=staged_input)
    run_checked(["git", "add", "--all"], cwd=staged_input)
    run_checked(
        [
            "git",
            "-c",
            "user.name=General Agent Eval",
            "-c",
            "user.email=general-agent-eval@example.invalid",
            "commit",
            "--allow-empty",
            "-m",
            "chore: testless baseline",
        ],
        cwd=staged_input,
    )
    return {
        "original_head": original_head,
        "original_branch": original_branch,
        "synthetic_baseline_commit": git_output(staged_input, ["rev-parse", "HEAD"]),
    }


def _inject_rest_assured_step(
    *,
    staged_input: Path,
    output_dir: Path,
    service: dict[str, Any] | None,
) -> dict[str, Any]:
    rest_assured_config = service.get("rest_assured") if service else None
    if rest_assured_config is None:
        # e.g. features-service ships a legacy RestAssured and omits the manifest block.
        print(
            "[rest-assured] skipped: service has no rest_assured config in the manifest",
            flush=True,
        )
        return {"enabled": True, "status": "skipped", "reason": "no rest_assured config"}

    from general_agent_eval.preprocessing.rest_assured_injection import (
        InjectionConfig,
        RestAssuredInjectionError,
        inject_rest_assured,
    )

    try:
        config = InjectionConfig.from_dict(rest_assured_config)
        result = inject_rest_assured(staged_input, config)
    except RestAssuredInjectionError as exc:
        raise DockerRunError(f"Failed to inject RestAssured: {exc}") from exc

    injection_patch = None
    if git_repo_root(staged_input) == staged_input:
        injection_patch_path = output_dir / "dependency_injection.patch"
        write_git_patch(
            staged_input=staged_input,
            output_path=injection_patch_path,
            relative_paths=[config.target_pom],
        )
        injection_patch = str(injection_patch_path)

    print(
        f"[rest-assured] {result.status} pom={config.target_pom} "
        f"version={'managed' if result.managed else result.version}",
        flush=True,
    )
    return {
        "enabled": True,
        **result.to_dict(),
        "dependency_injection_patch": injection_patch,
    }


def preprocess_staged_input(
    *,
    args: argparse.Namespace,
    staged_input: Path,
    output_dir: Path,
    reset_target: GitResetTarget | None = None,
    service: dict[str, Any] | None = None,
) -> dict[str, Any]:
    inject_enabled = getattr(args, "inject_rest_assured", False)
    preprocessing: dict[str, Any] = {
        "reset_git": {"enabled": args.reset_git},
        "test_clearing": {"enabled": args.clear_tests},
        "rest_assured_injection": {"enabled": inject_enabled},
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

    if args.clear_tests:
        from general_agent_eval.preprocessing.java_test_clearing import (
            TestClearingError,
            clear_java_tests,
        )

        try:
            clear_result = clear_java_tests(staged_input)
        except TestClearingError as exc:
            raise DockerRunError(f"Failed to clear Java tests: {exc}") from exc

        clearing_manifest_path = output_dir / "cleared_tests.json"
        write_manifest(clearing_manifest_path, clear_result.to_dict())

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

    if inject_enabled:
        preprocessing["rest_assured_injection"] = _inject_rest_assured_step(
            staged_input=staged_input,
            output_dir=output_dir,
            service=service,
        )

    # Commit the testless baseline once, after clearing and injection, so both the
    # cleared tree and the injected dependency land in the baseline and stay out of
    # the agent's diff. Patches above were captured first, against the original git.
    if args.clear_tests or inject_enabled:
        git_baseline = initialize_synthetic_git_baseline(staged_input)
        preprocessing["git_baseline"] = git_baseline
        if args.clear_tests:
            preprocessing["test_clearing"]["git_history_sanitized"] = True
            preprocessing["test_clearing"]["git_baseline"] = git_baseline

    return preprocessing


def build_image() -> None:
    if not DEFAULT_DOCKERFILE.is_file():
        raise DockerRunError(f"Default Dockerfile is not a file: {DEFAULT_DOCKERFILE}")

    buildx_check = subprocess.run(
        ["docker", "buildx", "version"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if buildx_check.returncode != 0:
        detail = buildx_check.stderr.strip() or buildx_check.stdout.strip()
        raise DockerRunError(
            "Docker Buildx is required to build the agent runtime image. "
            "Install the Docker Buildx CLI plugin and verify `docker buildx version` "
            f"works. {detail}"
        )

    uid = getattr(os, "getuid", lambda: 1000)()
    gid = getattr(os, "getgid", lambda: 1000)()
    command = [
        "docker",
        "buildx",
        "build",
        "--load",
        "-f",
        str(DEFAULT_DOCKERFILE),
        "-t",
        DEFAULT_IMAGE,
        "--build-arg",
        f"AGENT_UID={uid}",
        "--build-arg",
        f"AGENT_GID={gid}",
        str(PROJECT_ROOT),
    ]
    subprocess.run(command, check=True)


def required_host_env_names(args: argparse.Namespace) -> tuple[str, ...]:
    names = [args.api_key_env, args.auth_token_env, args.oauth_token_env]
    return tuple(dict.fromkeys(name for name in names if name))


def validate_host_env(names: tuple[str, ...]) -> None:
    missing = [name for name in names if name not in os.environ]
    if missing:
        raise DockerRunError(
            "Required host environment variables are unset: " + ", ".join(missing)
        )


def validate_agent_values(args: argparse.Namespace) -> None:
    for value in args.env:
        parse_key_value_key(value, option_name="--env")


def load_service_manifest(manifest_path: Path) -> dict[str, Any]:
    resolved_path = manifest_path.expanduser().resolve()
    if not resolved_path.is_file():
        raise DockerRunError(f"service manifest is not a file: {resolved_path}")
    try:
        payload = json.loads(resolved_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise DockerRunError(
            f"service manifest is invalid JSON: {resolved_path}"
        ) from exc
    services = payload.get("services")
    if not isinstance(services, dict):
        raise DockerRunError(
            f"service manifest must contain an object at 'services': {resolved_path}"
        )
    return services


def resolve_service_manifest_path(args: argparse.Namespace) -> Path:
    service_manifest = getattr(args, "service_manifest", None)
    service_scripts_dir = getattr(args, "service_scripts_dir", None)
    if service_manifest is not None:
        return service_manifest.expanduser().resolve()
    if service_scripts_dir is not None:
        return (service_scripts_dir.expanduser().resolve() / "services.json")
    raise DockerRunError(
        "--service requires --service-manifest or --service-scripts-dir"
    )


def resolve_service_scripts_dir(args: argparse.Namespace) -> Path:
    service_scripts_dir = getattr(args, "service_scripts_dir", None)
    if service_scripts_dir is None:
        raise DockerRunError("--service requires --service-scripts-dir")
    scripts_dir = service_scripts_dir.expanduser().resolve()
    if not scripts_dir.is_dir():
        raise DockerRunError(f"--service-scripts-dir is not a directory: {scripts_dir}")
    run_script = scripts_dir / "run-with-service.sh"
    if not run_script.is_file():
        raise DockerRunError(
            f"--service-scripts-dir must contain run-with-service.sh: {scripts_dir}"
        )
    return scripts_dir


def resolve_service(args: argparse.Namespace) -> dict[str, Any] | None:
    if not args.service:
        if args.service_port is not None:
            raise DockerRunError("--service-port requires --service")
        return None
    services = load_service_manifest(resolve_service_manifest_path(args))
    if args.service not in services:
        known = ", ".join(sorted(services))
        raise DockerRunError(f"unknown --service '{args.service}' (known: {known})")
    svc = services[args.service]
    port = args.service_port or int(svc["default_port"])

    def url(path: str) -> str:
        if not path.startswith("/"):
            path = "/" + path
        return f"http://127.0.0.1:{port}{path}"

    return {
        "id": args.service,
        "port": port,
        "base_url": url(svc.get("base_path", "/")),
        "rest_assured": svc.get("rest_assured"),
    }


def service_prompt_vars(service: dict[str, Any]) -> tuple[str, ...]:
    return (
        f"service_id={service['id']}",
        f"service_base_url={service['base_url']}",
    )


def rest_assured_prompt_vars(service: dict[str, Any]) -> tuple[str, ...]:
    """Prompt vars exposed only when RestAssured was injected: a presence flag and,
    for multi-module builds, the module directory whose tests carry the dependency."""
    config = service.get("rest_assured")
    if not config:
        return ()
    prompt_vars = ("rest_assured=1",)
    target_pom = str(config.get("target_pom", "pom.xml"))
    if "/" in target_pom:
        prompt_vars = (*prompt_vars, f"test_module={target_pom.rsplit('/', 1)[0]}")
    return prompt_vars


def build_agent_request(
    args: argparse.Namespace, service: dict[str, Any] | None = None
) -> AgentRunRequest:
    agent_env = tuple(args.env)
    prompt_vars: tuple[str, ...] = ()
    if service is not None:
        # Expose the base URL both to generated tests (env) and to the prompt templates.
        agent_env = (*agent_env, f"SERVICE_BASE_URL={service['base_url']}")
        prompt_vars = service_prompt_vars(service)
        if getattr(args, "inject_rest_assured", False):
            prompt_vars = (*prompt_vars, *rest_assured_prompt_vars(service))
    return AgentRunRequest(
        container_input_dir=CONTAINER_INPUT_DIR,
        container_output_dir=CONTAINER_OUTPUT_DIR,
        model=args.model,
        permission_mode=args.permission_mode,
        system_prompt_config=args.system_prompt_config,
        base_url=args.base_url,
        api_key_env=args.api_key_env,
        auth_token_env=args.auth_token_env,
        oauth_token_env=args.oauth_token_env,
        max_turns=args.max_turns,
        max_budget_usd=args.max_budget_usd,
        # Docker preprocessing owns reset order so tests cannot be restored later.
        reset_git=False,
        agent_env=agent_env,
        prompt_vars=prompt_vars,
        extra_args=tuple(args.extra_arg),
    )


def build_docker_command(
    *,
    args: argparse.Namespace,
    staged_input: Path,
    output_dir: Path,
    agent_command: list[str],
    host_env_names: tuple[str, ...],
    service: dict[str, Any] | None = None,
    service_scripts_dir: Path | None = None,
) -> list[str]:
    command = [
        "docker",
        "run",
        "--rm",
        "--workdir",
        "/app",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--network",
        args.network,
        "--pids-limit",
        str(args.pids_limit),
    ]
    if args.memory:
        command.extend(["--memory", args.memory])
    if args.cpus:
        command.extend(["--cpus", str(args.cpus)])
    for env_name in host_env_names:
        command.extend(["-e", env_name])
    command.extend(["-v", f"{PROJECT_ROOT}:{CONTAINER_APP_DIR}:ro"])
    if service is not None:
        if service_scripts_dir is None:
            raise DockerRunError("service_scripts_dir is required when service is set")
        command.extend(
            [
                "-v",
                f"{service_scripts_dir}:{CONTAINER_SERVICE_SCRIPTS_DIR}:ro",
            ]
        )
    command.extend(
        [
            "-v",
            f"{staged_input}:{CONTAINER_INPUT_DIR}:rw",
            "-v",
            f"{output_dir}:{CONTAINER_OUTPUT_DIR}:rw",
            DEFAULT_IMAGE,
        ]
    )
    if service is not None:
        # Start the service (health-gated, backgrounded) before exec'ing the agent.
        command.extend(
            [
                "bash",
                f"{CONTAINER_SERVICE_SCRIPTS_DIR}/run-with-service.sh",
                service["id"],
                "--repo",
                CONTAINER_INPUT_DIR,
                "--host",
                "127.0.0.1",
                "--port",
                str(service["port"]),
                "--",
            ]
        )
    command.extend(agent_command)
    return command


def stream_command(command: list[str], *, log_path: Path) -> int:
    with subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    ) as process:
        if process.stdout is None:
            raise DockerRunError("Failed to capture Docker output")
        with log_path.open("w", encoding="utf-8") as log_file:
            for line in process.stdout:
                print(line, end="")
                log_file.write(line)
                log_file.flush()
        return process.wait()


def collect_git_artifacts(staged_input: Path, output_dir: Path) -> dict[str, str]:
    if git_repo_root(staged_input) != staged_input:
        return {}

    artifacts: dict[str, str] = {}

    def write_git_artifact(filename: str, git_args: list[str]) -> None:
        result = subprocess.run(
            ["git", "-C", str(staged_input), *git_args],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        path = output_dir / filename
        if result.returncode == 0:
            path.write_text(result.stdout, encoding="utf-8")
        else:
            path.write_text(result.stderr or result.stdout, encoding="utf-8")
        artifacts[filename] = str(path)

    write_git_artifact("git_status.txt", ["status", "--short"])
    write_git_artifact(
        "git_untracked.txt", ["ls-files", "--others", "--exclude-standard"]
    )
    subprocess.run(
        ["git", "-C", str(staged_input), "add", "--intent-to-add", "--all"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    write_git_artifact("git_diff.patch", ["diff", "--binary"])
    return artifacts


def is_agent_result_message(message: object) -> bool:
    if not isinstance(message, dict):
        return False
    return (
        "total_cost_usd" in message
        or "num_turns" in message
        or "duration_ms" in message
    )


def collect_agent_result_summary(
    output_dir: Path,
    output_jsonl_name: str | None,
    *,
    cost_is_estimate: bool = False,
) -> dict[str, Any] | None:
    if output_jsonl_name is None:
        return None

    summary: dict[str, Any] = {
        "source_jsonl": output_jsonl_name,
        "available": False,
    }
    output_jsonl_path = output_dir / output_jsonl_name
    if not output_jsonl_path.is_file():
        return summary

    summary["available"] = True
    result_message: dict[str, Any] | None = None
    invalid_json_lines = 0
    with output_jsonl_path.open(encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                invalid_json_lines += 1
                continue
            if is_agent_result_message(message):
                result_message = message

    if invalid_json_lines:
        summary["invalid_json_lines"] = invalid_json_lines
    if result_message is None:
        return summary

    for key in AGENT_RESULT_SUMMARY_KEYS:
        if key in result_message:
            summary[key] = result_message[key]
    if cost_is_estimate and "total_cost_usd" in summary:
        summary["total_cost_usd_is_estimate"] = True
        summary["total_cost_usd_note"] = COST_ESTIMATE_NOTE
    return summary


def sanitized_manifest(
    *,
    args: argparse.Namespace,
    input_dir: Path,
    run_dir: Path,
    staged_input: Path,
    output_dir: Path,
    staging_method: str,
    host_env_names: tuple[str, ...],
    preprocessing: dict[str, Any],
    service: dict[str, Any] | None = None,
    service_scripts_dir: Path | None = None,
) -> dict[str, Any]:
    service_manifest = None
    if service is not None:
        service_manifest = str(resolve_service_manifest_path(args))
    return {
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "service": service,
        "service_manifest": service_manifest,
        "service_scripts_dir": str(service_scripts_dir) if service_scripts_dir else None,
        "agent": args.agent,
        "agent_description": AGENT_SPECS[args.agent].description,
        "agent_output_jsonl": AGENT_SPECS[args.agent].output_jsonl_name,
        "input_dir": str(input_dir),
        "output_root": str(run_dir.parent),
        "run_dir": str(run_dir),
        "staged_input": str(staged_input),
        "output_dir": str(output_dir),
        "staging_method": staging_method,
        "preprocessing": preprocessing,
        "docker": {
            "image": DEFAULT_IMAGE,
            "dockerfile": str(DEFAULT_DOCKERFILE),
            "network": args.network,
            "memory": args.memory,
            "cpus": args.cpus,
            "pids_limit": args.pids_limit,
            "skip_build": args.skip_build,
        },
        "agent_options": {
            "model": args.model,
            "permission_mode": args.permission_mode,
            "system_prompt_config": args.system_prompt_config,
            "base_url": args.base_url,
            "api_key_env": args.api_key_env,
            "auth_token_env": args.auth_token_env,
            "oauth_token_env": args.oauth_token_env,
            "max_turns": args.max_turns,
            "max_budget_usd": args.max_budget_usd,
            "reset_git": args.reset_git,
            "clear_tests": args.clear_tests,
            "inject_rest_assured": args.inject_rest_assured,
            "agent_env_keys": [
                parse_key_value_key(value, option_name="--env") for value in args.env
            ],
            "extra_args": list(args.extra_arg),
        },
        "host_env_passthrough": list(host_env_names),
    }


def write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a general coding agent against a staged project in Docker."
    )
    parser.add_argument(
        "--agent",
        choices=sorted(AGENT_SPECS),
        default="claude-code",
        help="Agent spec to run inside the shared Docker runtime.",
    )
    parser.add_argument(
        "--input-dir",
        required=True,
        type=Path,
        help="Project directory to stage into the container.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help=(
            "Parent directory for run outputs. A unique "
            f"<timestamp>{RUN_ID_DELIMITER}<agent>{RUN_ID_DELIMITER}<project> "
            "run directory is created inside it."
        ),
    )
    parser.add_argument(
        "--service",
        help=(
            "Service id to build, start, and health-gate in the container "
            "before the agent runs. Requires --service-scripts-dir and a "
            "services.json manifest. "
            "The agent receives its base URL via the prompt and SERVICE_BASE_URL."
        ),
    )
    parser.add_argument(
        "--service-manifest",
        type=Path,
        help=(
            "Path to a services.json manifest. If omitted with --service, "
            "--service-scripts-dir/services.json is used."
        ),
    )
    parser.add_argument(
        "--service-scripts-dir",
        type=Path,
        help=(
            "Path to the service scripts directory containing run-with-service.sh. "
            "Required with --service so the directory can be mounted into Docker."
        ),
    )
    parser.add_argument(
        "--service-port",
        type=positive_int,
        help="HTTP port override for --service (default: the service's default port).",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Run the existing image without building it first.",
    )
    parser.add_argument(
        "--network",
        default="bridge",
        help="Docker network mode. Use none only for non-networked smoke runs.",
    )
    parser.add_argument(
        "--memory",
        default="4g",
        help="Docker memory limit, or an empty string for Docker's default.",
    )
    parser.add_argument(
        "--cpus",
        type=positive_float,
        help="Docker CPU quota.",
    )
    parser.add_argument(
        "--pids-limit",
        type=positive_int,
        default=512,
        help="Docker process limit.",
    )
    parser.add_argument(
        "--model",
        default="sonnet",
        help="Model value passed through to the selected agent.",
    )
    parser.add_argument(
        "--permission-mode",
        choices=PERMISSION_MODES,
        default=DEFAULT_PERMISSION_MODE,
        help=(
            "Claude Code permission mode for the claude-code agent. Defaults "
            "to bypassPermissions."
        ),
    )
    parser.add_argument(
        "--system-prompt-config",
        choices=("append", "replace", "none"),
        default="replace",
        help=(
            "How the claude-code agent applies its rendered system template. "
            "Defaults to replace (rendered template becomes the entire system "
            "prompt; errors if it renders empty)."
        ),
    )
    parser.add_argument(
        "--base-url",
        help="Custom Anthropic-compatible endpoint for the claude-code agent.",
    )
    parser.add_argument(
        "--api-key-env",
        help="Host env var to pass into Docker and use as ANTHROPIC_API_KEY.",
    )
    parser.add_argument(
        "--auth-token-env",
        help="Host env var to pass into Docker and use as ANTHROPIC_AUTH_TOKEN.",
    )
    parser.add_argument(
        "--oauth-token-env",
        help="Host env var containing a Claude Code OAuth token.",
    )
    parser.add_argument(
        "--env",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="Additional Claude Code environment variable. Can be repeated.",
    )
    parser.add_argument(
        "--extra-arg",
        action="append",
        default=[],
        metavar="FLAG[=VALUE]",
        help=(
            "Extra passthrough argument forwarded verbatim to the selected agent. "
            "Its meaning is agent-specific. Can be repeated."
        ),
    )
    parser.add_argument(
        "--max-turns",
        type=positive_int,
        help="Maximum agentic turns before the selected agent exits.",
    )
    parser.add_argument(
        "--max-budget-usd",
        type=positive_float,
        help="Maximum dollar budget before the selected agent exits.",
    )
    parser.add_argument(
        "--reset-git",
        action="store_true",
        help=(
            "Reset staged Git state before Docker preprocessing. This runs "
            "before --clear-tests and is not forwarded to the agent."
        ),
    )
    parser.add_argument(
        "--clear-tests",
        action="store_true",
        help=(
            "Remove Java test directories/files before the agent runs; strongly "
            "recommended for isolated test construction analysis."
        ),
    )
    parser.add_argument(
        "--inject-rest-assured",
        action="store_true",
        help=(
            "Inject RestAssured as a test dependency before the agent runs, using "
            "the matched service's rest_assured config from the manifest. Requires "
            "--service. Runs after --clear-tests; the POM edit lands in the testless "
            "baseline, so it stays out of the agent's diff."
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        input_dir = args.input_dir.expanduser().resolve()
        if not input_dir.exists():
            raise DockerRunError(f"--input-dir does not exist: {args.input_dir}")
        if not input_dir.is_dir():
            raise DockerRunError(f"--input-dir is not a directory: {args.input_dir}")

        output_root = (
            args.output_dir.expanduser().resolve()
            if args.output_dir
            else default_output_root(input_dir=input_dir).resolve()
        )
        run_dir = output_root / build_run_id(input_dir=input_dir, agent_name=args.agent)
        host_env_names = required_host_env_names(args)
        validate_host_env(host_env_names)
        validate_agent_values(args)
        service = resolve_service(args)
        service_scripts_dir = (
            resolve_service_scripts_dir(args) if service is not None else None
        )
        if args.inject_rest_assured and service is None:
            raise DockerRunError(
                "--inject-rest-assured requires --service; the rest_assured config "
                "is read from the service manifest"
            )
        reset_target = None
        if args.reset_git:
            from general_agent_eval.preprocessing.git_reset import (
                GitVcsError,
                resolve_reset_target,
            )

            try:
                reset_target = resolve_reset_target(input_dir)
            except GitVcsError as exc:
                raise DockerRunError(
                    f"Failed to resolve Git reset target: {exc}"
                ) from exc
        prepare_run_dir(run_dir, input_dir=input_dir)

        staged_input = run_dir / "input"
        output_dir = run_dir / "output"
        output_dir.mkdir()

        if not args.skip_build:
            build_image()

        staging_method = stage_input(input_dir, staged_input)
        preprocessing = preprocess_staged_input(
            args=args,
            staged_input=staged_input,
            output_dir=output_dir,
            reset_target=reset_target,
            service=service,
        )
        agent_spec = AGENT_SPECS[args.agent]
        agent_command = agent_spec.build_command(build_agent_request(args, service))
        manifest_path = run_dir / "manifest.json"
        manifest = sanitized_manifest(
            args=args,
            input_dir=input_dir,
            run_dir=run_dir,
            staged_input=staged_input,
            output_dir=output_dir,
            staging_method=staging_method,
            host_env_names=host_env_names,
            preprocessing=preprocessing,
            service=service,
            service_scripts_dir=service_scripts_dir,
        )
        write_manifest(manifest_path, manifest)

        docker_command = build_docker_command(
            args=args,
            staged_input=staged_input,
            output_dir=output_dir,
            agent_command=agent_command,
            host_env_names=host_env_names,
            service=service,
            service_scripts_dir=service_scripts_dir,
        )
        print(f"[docker-run] run_dir={run_dir}", flush=True)
        print(f"[docker-run] agent={args.agent} image={DEFAULT_IMAGE}", flush=True)
        if service is not None:
            print(
                f"[docker-run] service={service['id']} base_url={service['base_url']}",
                flush=True,
            )
        exit_code = stream_command(
            docker_command,
            log_path=output_dir / "docker.log",
        )
        manifest["exit_code"] = exit_code
        manifest["agent_result"] = collect_agent_result_summary(
            output_dir,
            agent_spec.output_jsonl_name,
            cost_is_estimate=args.base_url is not None,
        )
        manifest["artifacts"] = collect_git_artifacts(staged_input, output_dir)
        write_manifest(manifest_path, manifest)
        return exit_code
    except DockerRunError as exc:
        parser.exit(2, f"error: {exc}\n")
    except subprocess.CalledProcessError as exc:
        parser.exit(exc.returncode or 1, f"error: command failed: {exc.cmd}\n")
    except KeyboardInterrupt:
        parser.exit(130, "interrupted\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
