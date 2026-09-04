"""Tests for the Playwright Test Agents baseline."""

from __future__ import annotations

from pathlib import Path

import pytest

from general_agent_eval.webtestpilot import playwright_agents as pwa
from general_agent_eval.webtestpilot.freeze import (
    NON_GENERATED_SPEC_NAMES,
    PLAYWRIGHT_AGENTS_DIR_NAMES,
    find_generated_dir,
    freeze_suite,
)

SPEC = """import { test, expect } from '@playwright/test';
test('generated', async ({ page }) => { await page.goto('/'); });
"""


@pytest.mark.parametrize("app", ["bookstack", "invoiceninja", "indico", "prestashop"])
def test_a_seed_test_exists_for_every_app(tmp_path: Path, app: str) -> None:
    written = pwa.write_seed_test(tmp_path, app)
    body = written.read_text("utf-8")
    assert written == tmp_path / "tests" / "seed.spec.ts"
    assert "test('seed'" in body
    # A seed sets up state; it must not assert anything, or it would count as coverage.
    assert "expect(" not in body


def test_seed_for_an_unknown_app_is_refused(tmp_path: Path) -> None:
    with pytest.raises(pwa.PlaywrightAgentsError, match="no seed defined"):
        pwa.write_seed_test(tmp_path, "not-an-app")


def test_the_driver_prompt_delegates_and_forbids_self_authoring() -> None:
    raw = pwa.build_driver_prompt("bookstack", "http://localhost:8081")
    # Collapse whitespace: the prompt is hard-wrapped, so phrases straddle newlines.
    prompt = " ".join(raw.split())
    for agent in (
        "playwright-test-planner",
        "playwright-test-generator",
        "playwright-test-healer",
    ):
        assert agent in prompt
    assert "Do not write the tests yourself" in prompt
    assert "http://localhost:8081" in prompt
    # The behavioural-postcondition requirement must match the other baseline's, so the two
    # generators are asked for the same standard of assertion.
    assert "behavioural postcondition" in prompt
    assert "1280x720" in prompt


def test_the_seed_is_excluded_from_the_frozen_suite(tmp_path: Path) -> None:
    """seed.spec.ts is setup. Freezing it would pad the clean-stability denominator."""
    workspace = tmp_path / "workspace"
    tests = workspace / "tests"
    tests.mkdir(parents=True)
    pwa.write_seed_test(workspace, "bookstack")
    (tests / "todo.spec.ts").write_text(SPEC, "utf-8")

    found = find_generated_dir(workspace, PLAYWRIGHT_AGENTS_DIR_NAMES)
    assert found == tests

    suite = freeze_suite(found, tmp_path / "frozen")
    assert suite.spec_count == 1, "only the generated spec should be frozen"
    assert "seed.spec.ts" not in suite.files
    assert "todo.spec.ts" in suite.files


def test_a_tests_dir_holding_only_a_seed_is_not_a_generated_suite(tmp_path: Path) -> None:
    """If the agents produced nothing, that must fail loudly rather than freeze the seed."""
    workspace = tmp_path / "workspace"
    (workspace / "tests").mkdir(parents=True)
    pwa.write_seed_test(workspace, "bookstack")

    from general_agent_eval.webtestpilot.freeze import FreezeError

    with pytest.raises(FreezeError):
        find_generated_dir(workspace, PLAYWRIGHT_AGENTS_DIR_NAMES)


def test_seed_names_are_the_ones_freeze_excludes() -> None:
    assert "seed.spec.ts" in NON_GENERATED_SPEC_NAMES


def test_install_reports_missing_artifacts_rather_than_succeeding(tmp_path: Path, monkeypatch) -> None:
    """A silent init-agents failure must not look like a successful install."""

    class _Ok:
        returncode = 0
        stdout = ""
        stderr = ""

    monkeypatch.setattr(pwa.subprocess, "run", lambda *a, **k: _Ok())
    problems = pwa.install_agents(tmp_path)
    assert problems and "did not produce" in problems[0]
    assert ".claude/agents/playwright-test-planner.md" in problems[0]


# ------------------------------------------------------------- seed disambiguation


def _scaffold(workspace: Path) -> None:
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "playwright.config.ts").write_text(
        "export default { testDir: '.', use: {} };\n", "utf-8"
    )


def test_the_init_agents_placeholder_seed_is_removed(tmp_path: Path) -> None:
    """Two seeds means the planner may pick the empty one and never sign in.

    That failure mode is silent: the suite would explore only the login page and look like a
    weak baseline rather than a broken setup.
    """
    workspace = tmp_path / "ws"
    _scaffold(workspace)
    pwa.write_seed_test(workspace, "bookstack")
    (workspace / "seed.spec.ts").write_text(
        "import { test } from '@playwright/test';\n"
        "test('seed', async ({ page }) => {\n  // generate code here.\n});\n",
        "utf-8",
    )

    notes = pwa.normalize_seed_layout(workspace)

    assert not (workspace / "seed.spec.ts").exists()
    assert (workspace / "tests" / "seed.spec.ts").is_file()
    assert any("placeholder seed" in note for note in notes)


def test_test_dir_is_pinned_to_the_agents_output(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    _scaffold(workspace)
    pwa.write_seed_test(workspace, "bookstack")

    pwa.normalize_seed_layout(workspace)

    assert "testDir: './tests'" in (workspace / "playwright.config.ts").read_text("utf-8")


def test_an_unrecognised_root_seed_is_reported_not_deleted(tmp_path: Path) -> None:
    """Only the recognisable placeholder is removed; anything else is surfaced, not destroyed."""
    workspace = tmp_path / "ws"
    _scaffold(workspace)
    pwa.write_seed_test(workspace, "bookstack")
    handwritten = workspace / "seed.spec.ts"
    handwritten.write_text("// a real seed somebody wrote\n", "utf-8")

    notes = pwa.normalize_seed_layout(workspace)

    assert handwritten.exists(), "a seed we do not recognise must never be deleted"
    assert any("left unrecognised" in note for note in notes)


def test_a_missing_seed_is_an_error(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    _scaffold(workspace)
    with pytest.raises(pwa.PlaywrightAgentsError, match="expected a seed test"):
        pwa.normalize_seed_layout(workspace)
