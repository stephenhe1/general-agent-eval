"""The Playwright Test Agents baseline.

A second, independent generator to compare against the project's generic Claude Code Web UI
prompt. Playwright ships three agents of its own (1.56+): a **planner** that explores the live
application and writes a Markdown plan, a **generator** that turns that plan into specs while
verifying selectors live, and a **healer** that replays failures until they pass.

Why it is worth comparing: it runs on the same host agent and model tier, but its shape is
different — plan first, then generate, then heal. The BookStack campaign's misses were
overwhelmingly *coverage* failures rather than weak assertions, and an explicit planning stage
is precisely the intervention that might address that.

Two protocol points matter for a fair comparison:

* The healer may **skip** a test when it concludes the functionality is broken. A skipped test
  cannot detect an injected fault, so healing must happen during generation only, against the
  clean application, and never against an injected build.
* `tests/seed.spec.ts` is setup, not generated coverage. It is excluded from the frozen suite
  (see ``freeze.NON_GENERATED_SPEC_NAMES``) so it cannot pad the clean-stability denominator.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from general_agent_eval.webtestpilot.apps import APPS

# Artifacts `npx playwright init-agents --loop=claude` is expected to produce.
EXPECTED_AGENT_FILES: tuple[str, ...] = (
    ".claude/agents/playwright-test-planner.md",
    ".claude/agents/playwright-test-generator.md",
    ".claude/agents/playwright-test-healer.md",
    ".mcp.json",
)


class PlaywrightAgentsError(RuntimeError):
    pass


# --------------------------------------------------------------------------- seed


# Each seed leaves the browser on a logged-in landing page, so the planner starts where a real
# user starts. Credentials come from the app registry — the same operating information the
# other baseline receives in APP_NOTES.md, so neither generator is advantaged.
_SEEDS: dict[str, str] = {
    "bookstack": """  await page.goto('/login');
  await page.fill('#email', 'admin@admin.com');
  await page.fill('#password', 'password');
  await page.getByRole('button', {{ name: 'Log In' }}).click();
  await page.waitForURL('/');""",
    "invoiceninja": """  await page.goto('/login');
  await page.locator('input[name="email"]').fill('admin@admin.com');
  await page.getByRole('textbox', {{ name: 'Password' }}).fill('password');
  await page.getByRole('button', {{ name: 'Login' }}).click();
  await page.waitForLoadState('domcontentloaded');""",
    "indico": """  await page.goto('/login/');
  await page.getByRole('textbox', {{ name: 'Username or email' }}).fill('admin@admin.com');
  await page.getByRole('textbox', {{ name: 'Password' }}).fill('webtestpilot');
  await page.getByRole('button', {{ name: /Login/ }}).click();
  await page.waitForLoadState('domcontentloaded');""",
    "prestashop": """  await page.goto('/');
  await page.getByRole('link', {{ name: /Sign in/ }}).click();
  await page.getByRole('textbox', {{ name: 'Email' }}).fill('auto.customer@example.com');
  await page.getByRole('textbox', {{ name: 'Password input' }}).fill('mypassword');
  await page.getByRole('button', {{ name: 'Sign in' }}).click();
  await page.waitForLoadState('domcontentloaded');""",
}

_SEED_TEMPLATE = """import {{ test }} from '@playwright/test';

/**
 * Seed test for the Playwright test agents.
 *
 * Its only job is to run the initialization the app needs and leave the browser on a
 * signed-in page, so the planner and generator inherit a usable `page`. It asserts nothing
 * and is deliberately excluded from the evaluated suite.
 */
test('seed', async ({{ page }}) => {{
{body}
}});
"""


def write_seed_test(workspace: Path, app: str) -> Path:
    """Write ``tests/seed.spec.ts`` for one application."""
    if app not in _SEEDS:
        raise PlaywrightAgentsError(f"no seed defined for app {app!r}")
    tests = workspace / "tests"
    tests.mkdir(parents=True, exist_ok=True)
    target = tests / "seed.spec.ts"
    target.write_text(_SEED_TEMPLATE.format(body=_SEEDS[app].format()), "utf-8")
    return target


# ------------------------------------------------------------------------ install


def install_agents(
    workspace: Path,
    *,
    runtime: str | None = None,
    image: str | None = None,
    timeout: int = 900,
) -> list[str]:
    """Run ``npx playwright init-agents --loop=claude`` in the workspace.

    When ``runtime`` is given the command runs inside that container runtime, so the agent
    definitions are produced by the same Playwright version that will execute the tests.
    """
    command = ["npx", "--yes", "playwright", "init-agents", "--loop=claude"]
    if runtime:
        command = [
            runtime, "run", "--rm", "--platform", "linux/arm64", "--network", "host",
            "-v", f"{workspace}:/workspace:rw", "-w", "/workspace",
            image or "wtp-agent:latest", *command,
        ]
    result = subprocess.run(
        command,
        cwd=None if runtime else str(workspace),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    problems: list[str] = []
    if result.returncode != 0:
        problems.append(f"init-agents exit {result.returncode}: {result.stderr[-600:]}")
    missing = [name for name in EXPECTED_AGENT_FILES if not (workspace / name).exists()]
    if missing:
        problems.append(f"init-agents did not produce: {missing}")
    return problems


def normalize_seed_layout(workspace: Path) -> list[str]:
    """Leave exactly one seed test, in `tests/`, and make collection unambiguous.

    ``init-agents`` scaffolds its own placeholder seed (a `test('seed')` whose body is the
    comment "generate code here") at the location its config resolves to. With the scaffold's
    ``testDir: '.'`` that stub is collected *and* competes with the real seed for the planner's
    attention. A planner that picks the stub never signs in, so it would explore only the login
    page and the resulting suite would be worthless — a failure that looks like a bad baseline
    rather than a setup defect.

    Returns a list of the actions taken, for the generation record.
    """
    notes: list[str] = []

    real = workspace / "tests" / "seed.spec.ts"
    for stub in sorted(workspace.glob("seed.spec.*")):
        if stub.resolve() == real.resolve():
            continue
        body = stub.read_text("utf-8", errors="ignore")
        # Only ever remove the recognisable placeholder, never a real seed.
        if "generate code here" in body or "// generate" in body:
            stub.unlink()
            notes.append(f"removed init-agents placeholder seed: {stub.name}")
        else:
            notes.append(f"left unrecognised root seed in place: {stub.name}")

    config = workspace / "playwright.config.ts"
    if config.is_file():
        text = config.read_text("utf-8")
        if "testDir: '.'" in text:
            config.write_text(text.replace("testDir: '.'", "testDir: './tests'"), "utf-8")
            notes.append("pinned testDir to ./tests so only the agents' output is collected")

    if not real.is_file():
        raise PlaywrightAgentsError(f"expected a seed test at {real}")
    return notes


# ------------------------------------------------------------------------- prompt


DRIVER_PROMPT = """A {app_title} instance is running at {base_url}. It is already built, seeded and
started — do not build, start, stop or reconfigure it.

This repository has Playwright's test agents installed as subagents: `playwright-test-planner`,
`playwright-test-generator` and `playwright-test-healer`. Use them, via the Task tool, to
produce a Playwright end-to-end suite for this application. Do not write the tests yourself.

Work in three stages.

**1. Plan.** Delegate to `playwright-test-planner`. Instruct it to explore the running
application broadly and produce a test plan covering the application's significant pages and
user journeys — not one narrow feature. `tests/seed.spec.ts` signs in and leaves the browser on
a logged-in page; the planner should use it to set up. Plans belong in `specs/`.

If the surface is large, run the planner more than once for different areas and keep every
plan, so coverage is not limited to whatever the first pass happened to notice.

**2. Generate.** For each plan in `specs/`, delegate to `playwright-test-generator` to turn it
into runnable specs under `tests/`. Every generated test must verify the meaningful behavioural
postcondition of the flow it exercises: when a flow creates, updates or deletes data, assert the
resulting values, counts, list membership, ordering or content — not merely that a page loaded
or an element became visible.

**3. Heal.** Run `npx playwright test` and delegate failures to `playwright-test-healer` until
the suite is green. Do not leave failing tests behind.

Constraints:

- Do not modify `tests/seed.spec.ts`.
- Do not modify application code; this instance is a black box.
- Prefer role-, label- and text-based locators over brittle CSS or positional selectors.
- Tests will later run at 1280x720, serially, with no retries — avoid depending on parallelism,
  on retries, or on state left behind by another test.
- If the healer cannot make a test pass, it may skip it, but say so in your summary.

Finish by summarising: the plans written, the spec files generated, how many tests the suite
contains, anything skipped, and any part of the application you could not cover.
"""


def build_driver_prompt(app: str, base_url: str) -> str:
    spec = APPS[app]
    return DRIVER_PROMPT.format(
        app_title=spec.name.capitalize(),
        base_url=base_url,
    )
