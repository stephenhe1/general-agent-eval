"""Application reset and frozen-suite execution."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from general_agent_eval.webtestpilot.apps import APPS
from general_agent_eval.webtestpilot.freeze import SPEC_SUFFIXES


class RunnerError(RuntimeError):
    pass


@dataclass
class TestOutcome:
    """One generated test's result in one execution of the suite."""

    # Not a pytest test class despite the name.
    __test__ = False

    file: str
    title: str
    status: str  # passed | failed | timedOut | skipped | interrupted
    duration_ms: int = 0
    error_message: str = ""
    error_stack: str = ""
    attachments: list[str] = field(default_factory=list)

    @property
    def key(self) -> str:
        return f"{self.file}::{self.title}"

    @property
    def ok(self) -> bool:
        return self.status in {"passed", "skipped"}

    def to_dict(self) -> dict[str, object]:
        return {
            "file": self.file,
            "title": self.title,
            "key": self.key,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "error_message": self.error_message,
            "error_stack": self.error_stack,
            "attachments": self.attachments,
        }


@dataclass
class SuiteRun:
    label: str
    exit_code: int
    outcomes: dict[str, TestOutcome] = field(default_factory=dict)
    activation: dict[str, bool] = field(default_factory=dict)
    activation_sources: dict[str, list[str]] = field(default_factory=dict)
    # Per test: did the fault's mutation actually change the DOM? None = unknown.
    mutation_applied: dict[str, bool | None] = field(default_factory=dict)
    artifacts_dir: Path | None = None
    stdout_tail: str = ""
    infrastructure_error: str = ""

    @property
    def activated(self) -> bool:
        return any(self.activation.values())

    @property
    def mutated(self) -> bool | None:
        """Did the fault change the page in any test? None when never observable.

        Distinct from :attr:`activated`, which only reports that the injected
        condition matched. A fault can arm and then mutate nothing.
        """
        seen = [v for v in self.mutation_applied.values() if v is not None]
        if not seen:
            return None
        return any(seen)

    @property
    def failures(self) -> list[TestOutcome]:
        return [o for o in self.outcomes.values() if not o.ok]

    def to_dict(self) -> dict[str, object]:
        return {
            "label": self.label,
            "exit_code": self.exit_code,
            "test_count": len(self.outcomes),
            "failure_count": len(self.failures),
            "activated": self.activated,
            "mutation_applied": self.mutated,
            "activation_sources": self.activation_sources,
            "infrastructure_error": self.infrastructure_error,
            "outcomes": {key: o.to_dict() for key, o in self.outcomes.items()},
        }


# --------------------------------------------------------------------------- app


def reset_via_command(command: str, *, cwd: Path | None = None, timeout: int = 900) -> None:
    """Reset an application through a caller-supplied shell command.

    Used for targets that are not one of the four Docker-composed benchmark apps
    (for example the evaluator's own self-test application). The contract is the
    same as start_app.sh: return 0 once the app is back in its deterministic
    seeded state.
    """
    result = subprocess.run(
        ["bash", "-c", command],
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RunnerError(
            f"reset command failed (exit {result.returncode}): {command}\n"
            f"stdout:\n{result.stdout[-2000:]}\nstderr:\n{result.stderr[-2000:]}"
        )


def reset_app(
    wtp_root: Path,
    app: str,
    *,
    timeout: int = 900,
    container_cli: str | None = None,
    ready_timeout: int | None = None,
) -> None:
    """Reset and reseed one benchmark application via WebTestPilot's own script.

    ``container_cli`` selects the container runtime through the script's
    CONTAINER_CLI contract. Left unset, the script's own default (docker) applies.

    ``ready_timeout`` is exported as ``READY_TIMEOUT_SECONDS`` for the script's *own*
    readiness gate. Without it the script falls back to its 60 s default, which is
    independent both of ``timeout`` (this subprocess's ceiling) and of the harness's
    later :func:`wait_for_app` poll -- so a slow application can fail the script's
    internal gate while every harness-side budget is still generous. PrestaShop crossed
    that 60 s line mid-campaign and aborted an evaluation at bug 5 of 23.
    """
    script = wtp_root / "webapps" / "start_app.sh"
    if not script.is_file():
        raise RunnerError(f"start_app.sh not found at {script}")
    env = dict(os.environ)
    if container_cli:
        env["CONTAINER_CLI"] = container_cli
    if ready_timeout:
        env["READY_TIMEOUT_SECONDS"] = str(ready_timeout)
    result = subprocess.run(
        ["bash", str(script), app],
        cwd=str(wtp_root),
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    if result.returncode != 0:
        raise RunnerError(
            f"start_app.sh {app} failed (exit {result.returncode})\n"
            f"stdout:\n{result.stdout[-4000:]}\nstderr:\n{result.stderr[-4000:]}"
        )


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Stop urllib from following redirects.

    ``start_app.sh`` health-gates with plain ``curl``, which does not follow
    redirects, and some readiness markers live in the redirect body itself
    (BookStack's ``/`` answers 302 with "Redirecting to ..."). Following the
    redirect would land on the login page and never match.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D102
        return None


def _fetch_without_redirect(url: str, *, timeout: int) -> tuple[int, str]:
    """GET a URL without following redirects; returns (status, body)."""
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(url, timeout=timeout) as response:
            return response.status, response.read(200_000).decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as exc:
        # With redirects disabled, 3xx arrives here too, body included.
        return exc.code, exc.read(200_000).decode("utf-8", errors="ignore")


def wait_for_app(
    app: str,
    *,
    base_url: str | None = None,
    timeout: int = 180,
    health_text: str | None = None,
) -> None:
    """Block until the application answers with its expected readiness marker."""
    spec = APPS[app]
    url = base_url or spec.base_url
    marker = spec.health_text if health_text is None else health_text
    deadline = time.monotonic() + timeout
    last = ""
    while time.monotonic() < deadline:
        try:
            status, body = _fetch_without_redirect(url, timeout=10)
            if not marker or marker in body:
                return
            last = f"readiness text {marker!r} absent (HTTP {status})"
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            last = str(exc)
        time.sleep(3)
    raise RunnerError(f"{app} not ready at {url} after {timeout}s ({last})")


# ------------------------------------------------------------------------- suite


def _walk_suites(node: dict, path: tuple[str, ...] = ()) -> list[tuple[tuple[str, ...], dict]]:
    """Flatten Playwright's nested JSON report into (file-path, spec) pairs."""
    out: list[tuple[tuple[str, ...], dict]] = []
    for suite in node.get("suites", []) or []:
        title = suite.get("title", "")
        for spec in suite.get("specs", []) or []:
            out.append((path + (title,), spec))
        out.extend(_walk_suites(suite, path + (title,)))
    return out


def _normalize_file(suite_path: tuple[str, ...], raw_file: str, root_dir: str) -> str:
    """Produce a stable, readable spec path.

    Playwright's ``file`` field is relative to ``rootDir`` and on macOS gets
    mangled by the /tmp -> /private/tmp symlink, yielding long ``../../..`` runs.
    The outermost suite title is the spec's file name, so prefer it and fall back
    to a resolved relative path.
    """
    if suite_path and suite_path[0].endswith(SPEC_SUFFIXES):
        return suite_path[0]
    if raw_file:
        try:
            resolved = (Path(root_dir) / raw_file).resolve()
            return resolved.relative_to(Path(root_dir).resolve()).as_posix()
        except (ValueError, OSError):
            return Path(raw_file).name
    return raw_file


def parse_json_report(report_path: Path) -> dict[str, TestOutcome]:
    data = json.loads(report_path.read_text("utf-8"))
    outcomes: dict[str, TestOutcome] = {}
    root_dir = str((data.get("config") or {}).get("rootDir") or "")

    for suite_path, spec in _walk_suites(data):
        file_name = _normalize_file(suite_path, str(spec.get("file", "")), root_dir)
        title = spec.get("title", "")
        for test in spec.get("tests", []) or []:
            results = test.get("results", []) or []
            if not results:
                continue
            last = results[-1]
            error = last.get("error") or {}
            errors = last.get("errors") or []
            message = str(error.get("message") or "")
            if not message and errors:
                message = str(errors[0].get("message") or "")
            attachments = [
                str(item.get("path"))
                for item in (last.get("attachments") or [])
                if item.get("path")
            ]
            outcome = TestOutcome(
                file=file_name,
                title=title,
                status=str(last.get("status") or test.get("status") or "unknown"),
                duration_ms=int(last.get("duration") or 0),
                error_message=message[:8000],
                error_stack=str(error.get("stack") or "")[:8000],
                attachments=attachments,
            )
            outcomes[outcome.key] = outcome

    return outcomes


def parse_sentinel_log(
    path: Path,
) -> tuple[dict[str, bool], dict[str, list[str]], dict[str, bool | None]]:
    """Read the fixture's activation NDJSON.

    Returns per-test ``armed``, the activation ``sources``, and ``mutation_applied``:
    whether the fault's mutation actually changed the DOM. The third map is distinct
    from ``armed`` because the upstream injector sets its sentinel whenever the
    *condition* matched, even if the mutation then found no target and no-opped.
    ``None`` means the flag was unreadable (older logs, or storage unavailable).
    """
    armed: dict[str, bool] = {}
    sources: dict[str, list[str]] = {}
    mutated: dict[str, bool | None] = {}
    if not path.is_file():
        return armed, sources, mutated
    for line in path.read_text("utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        file_name = Path(str(entry.get("file", ""))).name
        key = f"{file_name}::{entry.get('title', '')}"
        was = bool(entry.get("armed"))
        armed[key] = armed.get(key, False) or was
        if was:
            sources.setdefault(key, []).extend(entry.get("sources") or [])
            applied = entry.get("mutation_applied")
            # True is sticky: the fault fires once per context, so a later record that
            # never saw the flag must not erase an observed mutation.
            if applied is True or mutated.get(key) is True:
                mutated[key] = True
            elif applied is False:
                mutated[key] = False
            else:
                mutated.setdefault(key, None)
    return armed, sources, mutated


def run_suite(
    *,
    label: str,
    instrumented_dir: Path,
    config_path: Path,
    project_dir: Path,
    base_url: str,
    output_dir: Path,
    bug_script_path: Path | None = None,
    timeout: int = 5400,
    env_extra: dict[str, str] | None = None,
) -> SuiteRun:
    """Execute the instrumented suite once and collect results plus activation.

    Only ``WTP_BUG_SCRIPT`` differs between the clean and buggy arms.
    """
    # Playwright runs with cwd=project_dir, so every path handed to it must be
    # absolute; a relative one would resolve against the project directory.
    instrumented_dir = Path(instrumented_dir).resolve()
    config_path = Path(config_path).resolve()
    project_dir = Path(project_dir).resolve()
    output_dir = Path(output_dir).resolve()
    if bug_script_path is not None:
        bug_script_path = Path(bug_script_path).resolve()

    output_dir.mkdir(parents=True, exist_ok=True)
    json_report = output_dir / "playwright-report.json"
    sentinel_log = output_dir / "activation.ndjson"
    artifacts_dir = output_dir / "artifacts"
    if artifacts_dir.exists():
        shutil.rmtree(artifacts_dir)

    env = dict(os.environ)
    env.update(
        {
            "WTP_TEST_DIR": str(instrumented_dir),
            "WTP_ARTIFACT_DIR": str(artifacts_dir),
            "WTP_JSON_REPORT": str(json_report),
            "WTP_SENTINEL_LOG": str(sentinel_log),
            "WTP_BASE_URL": base_url,
            "PLAYWRIGHT_BASE_URL": base_url,
            "CI": "1",
        }
    )
    env["WTP_BUG_SCRIPT"] = str(bug_script_path) if bug_script_path else ""
    if env_extra:
        env.update(env_extra)

    command = ["npx", "playwright", "test", "--config", str(config_path)]
    run = SuiteRun(label=label, exit_code=-1, artifacts_dir=artifacts_dir)

    try:
        completed = subprocess.run(
            command,
            cwd=str(project_dir),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        run.exit_code = completed.returncode
        run.stdout_tail = (completed.stdout or "")[-20_000:]
        (output_dir / "stdout.log").write_text(completed.stdout or "", "utf-8")
        (output_dir / "stderr.log").write_text(completed.stderr or "", "utf-8")
    except subprocess.TimeoutExpired:
        run.infrastructure_error = f"playwright run exceeded {timeout}s"
        return run

    if not json_report.is_file():
        run.infrastructure_error = (
            f"playwright produced no JSON report (exit {run.exit_code}); "
            f"stderr tail: {(completed.stderr or '')[-2000:]}"
        )
        return run

    try:
        run.outcomes = parse_json_report(json_report)
    except (json.JSONDecodeError, OSError) as exc:
        run.infrastructure_error = f"unparseable JSON report: {exc}"
        return run

    run.activation, run.activation_sources, run.mutation_applied = parse_sentinel_log(
        sentinel_log
    )

    if not run.outcomes:
        run.infrastructure_error = f"suite executed no tests (exit {run.exit_code})"

    return run
