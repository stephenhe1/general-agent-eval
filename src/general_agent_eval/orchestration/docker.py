"""Build the shared agent runtime image and compose the docker run command."""

from __future__ import annotations

import argparse
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from general_agent_eval.orchestration.errors import DockerRunError
from general_agent_eval.orchestration.paths import PROJECT_ROOT

MODULE_DIR = Path(__file__).resolve().parent

DEFAULT_DOCKERFILE = MODULE_DIR / "Dockerfile.agent-runtime"
DEFAULT_IMAGE = "general-agent-eval-agent:latest"
CONTAINER_APP_DIR = "/app"
CONTAINER_INPUT_DIR = "/workspace/input"
CONTAINER_OUTPUT_DIR = "/workspace/output"
CONTAINER_SERVICE_SCRIPTS_DIR = "/workspace/service-scripts"
CONTAINER_TEMPLATES_DIR = "/workspace/templates"


@dataclass(frozen=True)
class TemplateMount:
    """A custom prompt template bind-mounted read-only into the container."""

    role: str  # "system" or "chat"
    host_path: Path
    container_dir: str
    container_path: str


def resolve_template_mounts(args: argparse.Namespace) -> tuple[TemplateMount, ...]:
    mounts: list[TemplateMount] = []
    for role, raw_path in (
        ("system", getattr(args, "system_template", None)),
        ("chat", getattr(args, "chat_template", None)),
    ):
        if raw_path is None:
            continue
        host_path = raw_path.expanduser().resolve()
        if not host_path.is_file():
            raise DockerRunError(f"--{role}-template is not a file: {raw_path}")
        # The parent directory is mounted (not just the file) so Jinja includes of
        # sibling templates keep resolving inside the container.
        container_dir = f"{CONTAINER_TEMPLATES_DIR}/{role}"
        mounts.append(
            TemplateMount(
                role=role,
                host_path=host_path,
                container_dir=container_dir,
                container_path=f"{container_dir}/{host_path.name}",
            )
        )
    return tuple(mounts)


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


def build_docker_command(
    *,
    args: argparse.Namespace,
    staged_input: Path,
    output_dir: Path,
    agent_command: list[str],
    host_env_names: tuple[str, ...],
    service: dict[str, Any] | None = None,
    service_scripts_dir: Path | None = None,
    template_mounts: tuple[TemplateMount, ...] = (),
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
    for mount in template_mounts:
        command.extend(["-v", f"{mount.host_path.parent}:{mount.container_dir}:ro"])
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
