"""Contract tests for the WebTestPilot CONTAINER_CLI compatibility layer.

These run against the real scripts in the WebTestPilot artifact and are skipped
when that checkout is not present. They deliberately exercise only the runtime
selection logic, which happens before any argument parsing or container work, so
no container runtime is required.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

WTP_ROOT = Path(
    os.environ.get("WTP_ROOT", "/Users/stephenhe/Projects/WebTestPilot/WebTestPilot")
)
SCRIPTS = ("start_app.sh", "stop_app.sh")

pytestmark = pytest.mark.skipif(
    not (WTP_ROOT / "webapps" / "start_app.sh").is_file(),
    reason=f"WebTestPilot artifact not found at {WTP_ROOT}",
)


def script(name: str) -> Path:
    return WTP_ROOT / "webapps" / name


def run(name: str, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    environment = dict(os.environ)
    # Drop any inherited selection so each case controls it explicitly.
    environment.pop("CONTAINER_CLI", None)
    if env:
        environment.update(env)
    return subprocess.run(
        ["bash", str(script(name)), *args],
        capture_output=True,
        text=True,
        timeout=120,
        env=environment,
        cwd=str(WTP_ROOT),
    )


@pytest.mark.parametrize("name", SCRIPTS)
def test_scripts_are_syntactically_valid(name: str) -> None:
    result = subprocess.run(
        ["bash", "-n", str(script(name))], capture_output=True, text=True, timeout=60
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("name", SCRIPTS)
def test_unsupported_runtime_is_rejected(name: str) -> None:
    result = run(name, "bookstack", env={"CONTAINER_CLI": "containerd"})
    assert result.returncode == 1
    assert "Unsupported CONTAINER_CLI" in result.stderr
    assert "docker, podman" in result.stderr


@pytest.mark.parametrize("name", SCRIPTS)
def test_default_runtime_is_docker(name: str) -> None:
    """With CONTAINER_CLI unset the scripts must select docker, not podman.

    Asserted through the missing-binary error, which names the runtime it chose.
    Meaningful only where docker is absent, which is the point: the default must
    not silently fall through to whatever runtime happens to be installed.
    """
    if shutil.which("docker"):
        pytest.skip("docker is installed; the default cannot be observed this way")
    result = run(name, "bookstack")
    assert result.returncode == 1
    assert "CONTAINER_CLI='docker'" in result.stderr
    assert "not on PATH" in result.stderr


@pytest.mark.parametrize("name", SCRIPTS)
def test_explicit_docker_matches_the_default(name: str) -> None:
    if shutil.which("docker"):
        pytest.skip("docker is installed; the default cannot be observed this way")
    explicit = run(name, "bookstack", env={"CONTAINER_CLI": "docker"})
    implicit = run(name, "bookstack")
    assert explicit.returncode == implicit.returncode == 1
    assert explicit.stderr == implicit.stderr


@pytest.mark.skipif(shutil.which("podman") is None, reason="podman not installed")
@pytest.mark.parametrize("name", SCRIPTS)
def test_podman_passes_runtime_preflight(name: str) -> None:
    """With podman selected, the preflight checks must not be what fails."""
    result = run(name, "definitely-not-an-app", env={"CONTAINER_CLI": "podman"})
    assert "Unsupported CONTAINER_CLI" not in result.stderr
    assert "not on PATH" not in result.stderr
    # It should get far enough to reject the unknown application instead.
    assert "Unsupported app" in result.stderr or "Unsupported app" in result.stdout


def test_no_docker_aliasing_in_either_script() -> None:
    """The layer must not implement podman support by aliasing docker."""
    for name in SCRIPTS:
        text = script(name).read_text("utf-8")
        lowered = text.lower()
        assert "alias docker" not in lowered
        assert "docker=podman" not in lowered.replace(" ", "")
        assert 'function docker' not in lowered
        # Every compose invocation must go through the resolved array.
        assert "docker compose down" not in text
        assert "docker compose up" not in text
