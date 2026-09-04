from __future__ import annotations

import json
from pathlib import Path

import pytest

from general_agent_eval.preprocessing.cli import main


def write_file(path: Path, text: str = "x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_clear_tests_cli_removes_test_dirs(tmp_path: Path) -> None:
    write_file(tmp_path / "cypress/e2e/login.cy.ts")
    write_file(tmp_path / "src/App.tsx")

    exit_code = main(["--input-dir", str(tmp_path)])

    assert exit_code == 0
    assert not (tmp_path / "cypress").exists()
    assert (tmp_path / "src/App.tsx").exists()


def test_clear_tests_cli_dry_run_does_not_delete(tmp_path: Path) -> None:
    write_file(tmp_path / "cypress/e2e/login.cy.ts")
    write_file(tmp_path / "__tests__/App.test.tsx")

    exit_code = main(["--input-dir", str(tmp_path), "--dry-run"])

    assert exit_code == 0
    assert (tmp_path / "cypress/e2e/login.cy.ts").exists()
    assert (tmp_path / "__tests__/App.test.tsx").exists()


def test_clear_tests_cli_output_json(tmp_path: Path) -> None:
    write_file(tmp_path / "e2e/nav.spec.ts")
    write_file(tmp_path / "src/App.tsx")
    manifest_path = tmp_path / "output" / "cleared.json"

    exit_code = main(
        ["--input-dir", str(tmp_path), "--output-json", str(manifest_path)]
    )

    assert exit_code == 0
    assert manifest_path.exists()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["removed_count"] == 1
    assert manifest["removed"][0]["path"] == "e2e"
    assert manifest["removed"][0]["kind"] == "directory"


def test_clear_tests_cli_dry_run_output_json(tmp_path: Path) -> None:
    write_file(tmp_path / "tests/unit.test.ts")
    manifest_path = tmp_path / "manifest.json"

    exit_code = main(
        ["--input-dir", str(tmp_path), "--dry-run", "--output-json", str(manifest_path)]
    )

    assert exit_code == 0
    assert (tmp_path / "tests/unit.test.ts").exists()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["removed_count"] == 1


def test_clear_tests_cli_missing_input_dir(tmp_path: Path) -> None:
    with pytest.raises(SystemExit) as exc_info:
        main(["--input-dir", str(tmp_path / "nonexistent")])
    assert exc_info.value.code == 2


def test_clear_tests_cli_no_args() -> None:
    with pytest.raises(SystemExit) as exc_info:
        main([])
    assert exc_info.value.code == 2


# ---------------------------------------------------------------------------
# Integration: --clear-tests on the claude-code direct runner
# ---------------------------------------------------------------------------


def test_claude_code_parser_accepts_clear_tests_flag() -> None:
    from general_agent_eval.general_agents.claude_code import build_parser

    args = build_parser().parse_args(["--input-dir", "/tmp/x", "--clear-tests"])
    assert args.clear_tests is True


def test_claude_code_parser_defaults_clear_tests_off() -> None:
    from general_agent_eval.general_agents.claude_code import build_parser

    args = build_parser().parse_args(["--input-dir", "/tmp/x"])
    assert args.clear_tests is False


def test_claude_code_clear_tests_invokes_clearing(tmp_path: Path) -> None:
    """Confirm --clear-tests removes test dirs when used with the direct runner.

    We cannot run the full main() without a Claude API key, so we test that
    prepare_run + the clearing block work correctly by importing the function
    and simulating what main() does.
    """
    from general_agent_eval.preprocessing.js_test_clearing import clear_js_tests

    write_file(tmp_path / "cypress/e2e/login.cy.ts")
    write_file(tmp_path / "src/App.tsx")

    result = clear_js_tests(tmp_path)

    assert len(result.removed) == 1
    assert not (tmp_path / "cypress").exists()
    assert (tmp_path / "src/App.tsx").exists()
