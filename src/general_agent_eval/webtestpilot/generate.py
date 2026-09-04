"""Drive the existing Claude Code harness to generate a suite, then freeze it.

The generation step is the project's normal generic Web UI test-generation flow
(``--workload javascript --mode baseline``) pointed at a sanitized workspace. No
benchmark specification, bug, or ground truth is passed to the agent, and the
prompt templates are the packaged ones.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

from general_agent_eval.webtestpilot import workspace as ws
from general_agent_eval.webtestpilot.apps import APPS
from general_agent_eval.webtestpilot import playwright_agents as pwa
from general_agent_eval.webtestpilot.freeze import (
    INSTRUMENTED_DIR_NAME,
    PLAYWRIGHT_AGENTS_DIR_NAMES,
    FrozenSuite,
    find_generated_dir,
    freeze_suite,
    instrument_suite,
)


class GenerationError(RuntimeError):
    pass


@dataclass
class GenerationResult:
    app: str
    mode: str
    workspace: Path
    generated_dir: Path | None = None
    frozen: FrozenSuite | None = None
    instrumented: Path | None = None
    config_path: Path | None = None
    exit_code: int = -1
    provisioning_failures: list[str] = field(default_factory=list)
    # How the suite was produced. Only "claude-code-<isolation>" is a baseline
    # result; "reused-workspace" means no agent ran (harness validation).
    suite_provenance: str = "unknown"
    # Which generator produced the suite: the project's generic Web UI prompt, or Playwright's
    # own planner/generator/healer agents. Recorded so results are never mixed by accident.
    generator: str = "claude-code-baseline"
    leakage: dict[str, object] = field(default_factory=dict)
    transcript_leakage: dict[str, object] = field(default_factory=dict)
    command: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "app": self.app,
            "isolation_mode": self.mode,
            "suite_provenance": self.suite_provenance,
            "generator": self.generator,
            "workspace": str(self.workspace),
            "generated_dir": str(self.generated_dir) if self.generated_dir else "",
            "frozen_root": str(self.frozen.root) if self.frozen else "",
            "frozen_spec_count": self.frozen.spec_count if self.frozen else 0,
            "frozen_file_hashes": self.frozen.files if self.frozen else {},
            "instrumented_root": str(self.instrumented) if self.instrumented else "",
            "exit_code": self.exit_code,
            "provisioning_failures": self.provisioning_failures,
            "command": self.command,
            "workspace_leakage_audit": self.leakage,
            "transcript_leakage_audit": self.transcript_leakage,
            "notes": self.notes,
        }


def build_host_command(
    *,
    workspace: Path,
    base_url: str,
    model: str,
    messages_jsonl: Path,
    max_budget_usd: float | None,
    max_turns: int | None,
    effort: str,
    auth_env: dict[str, str],
    user_template: Path | None = None,
    system_prompt_config: str = "replace",
) -> list[str]:
    command = [
        sys.executable,
        "-m",
        "general_agent_eval.general_agents.claude_code",
        "--input-dir",
        str(workspace),
        "--workload",
        "javascript",
        "--mode",
        "baseline",
        "--coverage-model",
        "flat",
        "--model",
        model,
        "--effort",
        effort,
        "--permission-mode",
        "bypassPermissions",
        "--system-prompt-config",
        system_prompt_config,
        "--output-jsonl",
        str(messages_jsonl),
        "--prompt-var",
        f"service_base_url={base_url}",
    ]
    if user_template is not None:
        command += ["--user-template", str(user_template)]
    if max_budget_usd is not None:
        command += ["--max-budget-usd", str(max_budget_usd)]
    if max_turns is not None:
        command += ["--max-turns", str(max_turns)]
    for flag, value in auth_env.items():
        command += [flag, value]
    return command


DEFAULT_AGENT_IMAGE = "wtp-agent:latest"


def build_container_command(
    *,
    image: str,
    workspace: Path,
    output_dir: Path,
    base_url: str,
    model: str,
    messages_jsonl_name: str,
    max_budget_usd: float | None,
    max_turns: int | None,
    effort: str,
    api_key: str,
    api_base_url: str | None,
    runtime: str = "podman",
    user_template_container_path: str | None = None,
    system_prompt_config: str = "replace",
) -> list[str]:
    """Run the generation agent inside a container that cannot see the benchmark.

    Only the sanitized workspace and an output directory are mounted. The benchmark tree is
    absent from the container filesystem, so leakage is structurally impossible rather than
    audited after the fact — which is the whole point of this mode.

    ``--network host`` is required, not incidental: the application under test is published on
    the podman VM's loopback, and the model gateway is reachable only through the VM's NAT.
    """
    command = [
        runtime, "run", "--rm",
        "--platform", "linux/arm64",
        "--network", "host",
        # Least privilege: the container is the isolation boundary, so drop what is not needed.
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "-v", f"{workspace}:/workspace:rw",
        "-v", f"{output_dir}:/out:rw",
        "-w", "/workspace",
        "-e", f"ANTHROPIC_API_KEY={api_key}",
    ]
    if api_base_url:
        command += ["-e", f"ANTHROPIC_BASE_URL={api_base_url}"]
    command += [
        "-e", f"PLAYWRIGHT_BASE_URL={base_url}",
        image,
        "python3", "-m", "general_agent_eval.general_agents.claude_code",
        "--input-dir", "/workspace",
        "--workload", "javascript",
        "--mode", "baseline",
        "--coverage-model", "flat",
        "--model", model,
        "--effort", effort,
        "--permission-mode", "bypassPermissions",
        "--system-prompt-config", system_prompt_config,
        "--output-jsonl", f"/out/{messages_jsonl_name}",
        "--prompt-var", f"service_base_url={base_url}",
    ]
    if user_template_container_path is not None:
        command += ["--user-template", user_template_container_path]
    if max_budget_usd is not None:
        command += ["--max-budget-usd", str(max_budget_usd)]
    if max_turns is not None:
        command += ["--max-turns", str(max_turns)]
    return command


def resolve_api_key(helper: Path | None = None) -> str:
    """Obtain a gateway key on the host so the container never needs the key helper.

    The host authenticates through an `apiKeyHelper` script; a container has neither the
    script's dependencies nor its stored profile. Running it here and passing only the
    resulting key keeps the credential path unchanged and out of the image.
    """
    import subprocess as _sp

    if os.environ.get("ANTHROPIC_API_KEY"):
        return os.environ["ANTHROPIC_API_KEY"]
    helper = helper or Path.home() / ".claude" / "getkey.sh"
    if not helper.is_file():
        raise GenerationError(
            "container isolation needs an API key: set ANTHROPIC_API_KEY or provide "
            f"{helper}"
        )
    # Invoked through a shell rather than exec'd: the helper may not carry an executable
    # shebang on its first line, which surfaces as OSError "Exec format error".
    shell = "/bin/zsh" if Path("/bin/zsh").exists() else "/bin/bash"
    result = _sp.run([shell, str(helper)], capture_output=True, text=True, timeout=120)
    key = (result.stdout or "").strip()
    if result.returncode != 0 or not key:
        raise GenerationError(
            f"api key helper failed (exit {result.returncode}): {(result.stderr or '')[-300:]}"
        )
    return key


def generate_suite(
    *,
    app: str,
    run_dir: Path,
    base_url: str,
    model: str,
    isolation: str = "host",
    max_budget_usd: float | None = None,
    max_turns: int | None = None,
    effort: str = "high",
    auth_env: dict[str, str] | None = None,
    timeout: int = 14_400,
    reuse_workspace: Path | None = None,
    preinstall: bool = True,
    container_image: str | None = None,
    container_runtime: str = "podman",
    generator: str = "claude-code-baseline",
) -> GenerationResult:
    """Generate, freeze, and instrument one application's suite."""
    if app not in APPS:
        raise GenerationError(f"unknown app {app!r}")

    generation_dir = run_dir / "generation"
    generation_dir.mkdir(parents=True, exist_ok=True)
    workspace = generation_dir / "workspace"
    messages_jsonl = generation_dir / "messages.jsonl"

    result = GenerationResult(app=app, mode=isolation, workspace=workspace, generator=generator)

    if reuse_workspace is not None:
        # Re-freezing an existing finished workspace (no new agent run).
        if workspace.exists():
            shutil.rmtree(workspace)
        shutil.copytree(reuse_workspace, workspace, symlinks=True)
        result.notes.append(f"reused existing workspace from {reuse_workspace}")
        result.suite_provenance = "reused-workspace"
        result.exit_code = 0
    else:
        ws.build_workspace(app, workspace, base_url=base_url)

        if preinstall:
            if isolation == "container":
                # node_modules must match the platform that will execute them. The agent runs
                # Linux inside the container, so provisioning happens there; the host tree is
                # rebuilt afterwards for the evaluation phase, which runs on the host.
                result.provisioning_failures = ws.provision_workspace_in_container(
                    workspace,
                    image=container_image or DEFAULT_AGENT_IMAGE,
                    runtime=container_runtime,
                )
            else:
                result.provisioning_failures = ws.provision_workspace(workspace)
            for failure in result.provisioning_failures:
                result.notes.append(f"provisioning: {failure}")

        user_template: Path | None = None
        # The packaged system prompt instructs the agent to write and validate the tests
        # itself and to maintain UI_COVERAGE.md. For the Playwright-agents baseline that
        # directly contradicts "delegate to the planner/generator/healer and do not write
        # tests yourself", and the agent resolves the conflict inconsistently — on one app it
        # delegated, on another it started writing its own exploratory specs and a coverage
        # tracker, i.e. it silently reverted to the other baseline's behaviour. Only the
        # driver prompt governs this generator.
        system_prompt_config = "replace"
        if generator == "playwright-agents":
            system_prompt_config = "none"
            # Playwright's agents are installed into the workspace as subagent definitions plus
            # an MCP server, by the same Playwright version that will run the tests.
            problems = pwa.install_agents(
                workspace,
                runtime=container_runtime if isolation == "container" else None,
                image=container_image or DEFAULT_AGENT_IMAGE,
            )
            for problem in problems:
                result.notes.append(f"init-agents: {problem}")
            if problems:
                raise GenerationError(
                    "playwright test agents were not installed: " + "; ".join(problems)
                )
            pwa.write_seed_test(workspace, app)
            for note in pwa.normalize_seed_layout(workspace):
                result.notes.append(f"seed layout: {note}")
            user_template = generation_dir / "driver_prompt.jinja2"
            user_template.write_text(pwa.build_driver_prompt(app, base_url), "utf-8")

        pre_audit = ws.audit_workspace(workspace, guarantee=isolation)
        if not pre_audit.clean:
            raise GenerationError(
                f"sanitized workspace failed its own pre-generation audit: "
                f"{pre_audit.to_dict()}"
            )

        if isolation == "container":
            command = build_container_command(
                image=container_image or DEFAULT_AGENT_IMAGE,
                workspace=workspace,
                output_dir=generation_dir,
                base_url=base_url,
                model=model,
                messages_jsonl_name=messages_jsonl.name,
                max_budget_usd=max_budget_usd,
                max_turns=max_turns,
                effort=effort,
                api_key=resolve_api_key(),
                api_base_url=os.environ.get("ANTHROPIC_BASE_URL"),
                runtime=container_runtime,
                user_template_container_path=(
                    f"/out/{user_template.name}" if user_template else None
                ),
                system_prompt_config=system_prompt_config,
            )
        elif isolation != "host":
            raise GenerationError(f"unknown isolation mode {isolation!r}")
        else:
            command = build_host_command(
                workspace=workspace,
                base_url=base_url,
                model=model,
                messages_jsonl=messages_jsonl,
                max_budget_usd=max_budget_usd,
                max_turns=max_turns,
                effort=effort,
                auth_env=auth_env or {},
                user_template=user_template,
                system_prompt_config=system_prompt_config,
            )
        result.command = command
        result.suite_provenance = f"claude-code-{isolation}"

        env = dict(os.environ)
        env["PLAYWRIGHT_BASE_URL"] = base_url
        completed = subprocess.run(
            command,
            cwd=str(Path(__file__).resolve().parents[3]),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        result.exit_code = completed.returncode
        (generation_dir / "agent_stdout.log").write_text(completed.stdout or "", "utf-8")
        (generation_dir / "agent_stderr.log").write_text(completed.stderr or "", "utf-8")
        if completed.returncode != 0:
            result.notes.append(
                f"agent exited {completed.returncode}; "
                f"stderr tail: {(completed.stderr or '')[-1500:]}"
            )

    # --- reinstate host-native dependencies -------------------------------------
    # The evaluation phase runs Playwright on the host, so a Linux node_modules left by the
    # container would be unusable. Rebuilt here, after the agent's output is already on disk.
    if isolation == "container" and reuse_workspace is None:
        failures = ws.reprovision_for_host(workspace)
        for failure in failures:
            result.notes.append(f"host reprovision: {failure}")

    # --- post-generation audits -------------------------------------------------
    audit = ws.audit_workspace(workspace, guarantee=isolation)
    result.leakage = audit.to_dict()
    if isolation == "host":
        transcript = ws.audit_transcript(messages_jsonl)
        result.transcript_leakage = transcript.to_dict()

    # --- freeze + instrument ----------------------------------------------------
    result.generated_dir = find_generated_dir(
        workspace,
        PLAYWRIGHT_AGENTS_DIR_NAMES if generator == "playwright-agents" else None,
    )
    result.frozen = freeze_suite(result.generated_dir, generation_dir / "frozen")
    # Inside the workspace: the fixture and config must resolve @playwright/test
    # from the project's own node_modules.
    instrumentation = instrument_suite(result.frozen, workspace / INSTRUMENTED_DIR_NAME)
    result.instrumented = instrumentation.root
    result.config_path = instrumentation.config

    (generation_dir / "generation.json").write_text(
        json.dumps(result.to_dict(), indent=2) + "\n", "utf-8"
    )
    return result
