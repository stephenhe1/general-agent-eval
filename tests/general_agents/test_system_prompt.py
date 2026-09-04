from __future__ import annotations

import pytest

from general_agent_eval.general_agents import claude_code
from general_agent_eval.general_agents.claude_code import (
    HarnessError,
    build_parser,
    build_system_prompt,
)

RENDERED = "You are a test generation agent.\n"


def test_replace_returns_rendered_prompt_as_entire_system_prompt() -> None:
    result = build_system_prompt("replace", RENDERED)
    assert result == RENDERED.strip()


def test_replace_errors_when_rendered_prompt_is_empty() -> None:
    with pytest.raises(HarnessError):
        build_system_prompt("replace", "   \n  ")


def test_append_wraps_rendered_prompt_in_preset() -> None:
    result = build_system_prompt("append", RENDERED)
    assert result == {
        "type": "preset",
        "preset": "claude_code",
        "append": RENDERED,
    }


def test_append_falls_back_to_preset_when_empty() -> None:
    assert build_system_prompt("append", "  ") == {
        "type": "preset",
        "preset": "claude_code",
    }


def test_none_ignores_rendered_prompt() -> None:
    assert build_system_prompt("none", RENDERED) == {
        "type": "preset",
        "preset": "claude_code",
    }


def test_default_system_prompt_config_is_replace() -> None:
    args = build_parser().parse_args(["--input-dir", "."])
    assert args.system_prompt_config == "replace"
    assert claude_code.build_system_prompt is build_system_prompt


# ---------------------------------------------------------------------------
# JavaScript UI prompt templates
# ---------------------------------------------------------------------------

def _js_context(
    tmp_path: object,
    *,
    service_base_url: str = "",
    mode: str = "",
    coverage_model: str = "",
) -> dict:
    prompt_vars: dict[str, str] = {}
    if service_base_url:
        prompt_vars["service_base_url"] = service_base_url
    if mode:
        prompt_vars["mode"] = mode
    if coverage_model:
        prompt_vars["coverage_model"] = coverage_model
    return claude_code.build_template_context(
        input_dir=claude_code.PROJECT_ROOT,
        model="sonnet",
        prompt_vars=prompt_vars or None,
    )


def test_js_system_template_renders_without_error() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_SYSTEM_TEMPLATE,
        _js_context(None),
    )
    assert "Playwright" in rendered or "E2E" in rendered or "frontend" in rendered


def test_js_user_template_renders_with_service_base_url() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, service_base_url="http://localhost:5173"),
    )
    assert "http://localhost:5173" in rendered


def test_js_user_template_renders_without_service_base_url() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None),
    )
    # The template has an else branch that does not require a URL.
    assert rendered  # non-empty
    assert "http://localhost:5173" not in rendered or "already running" not in rendered


# ---------------------------------------------------------------------------
# Project-aware mode (Mode 2)
# ---------------------------------------------------------------------------

def test_js_system_template_project_aware_mode() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_SYSTEM_TEMPLATE,
        _js_context(None, mode="project-aware"),
    )
    assert "existing tests" in rendered
    assert "established" in rendered or "conventions" in rendered


def test_js_system_template_baseline_mode_no_project_aware_text() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_SYSTEM_TEMPLATE,
        _js_context(None, mode="baseline"),
    )
    assert "existing tests" not in rendered


def test_js_user_template_project_aware_mode_includes_convention_instructions() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, mode="project-aware"),
    )
    assert "existing test" in rendered or "conventions" in rendered
    assert "page objects" in rendered or "helpers" in rendered
    # Should NOT include the .bak warning (irrelevant when tests aren't cleared)
    assert ".bak" not in rendered


def test_js_user_template_baseline_mode_includes_bak_warning() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, mode="baseline"),
    )
    assert ".bak" in rendered
    assert "from scratch" in rendered


def test_js_user_template_default_mode_same_as_baseline() -> None:
    default_rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None),
    )
    baseline_rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, mode="baseline"),
    )
    assert default_rendered == baseline_rendered


# ---------------------------------------------------------------------------
# Coverage model: graph format
# ---------------------------------------------------------------------------

def test_js_system_template_graph_model_references_json_file() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_SYSTEM_TEMPLATE,
        _js_context(None, coverage_model="graph"),
    )
    assert "UI_GRAPH.json" in rendered
    assert "UI_COVERAGE.md" not in rendered


def test_js_system_template_flat_model_references_md_file() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_SYSTEM_TEMPLATE,
        _js_context(None, coverage_model="flat"),
    )
    assert "UI_COVERAGE.md" in rendered
    assert "UI_GRAPH.json" not in rendered


def test_js_user_template_graph_discovery_includes_json_schema() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, mode="discovery", coverage_model="graph"),
    )
    assert "UI_GRAPH.json" in rendered
    assert '"nodes"' in rendered
    assert '"edges"' in rendered
    assert '"trigger"' in rendered
    assert '"actions"' in rendered
    assert "Rendered interface" in rendered
    assert "Action availability" in rendered
    assert "auto-dismissing notifications" in rendered
    assert "immediately redirect" in rendered
    assert "Consistency rule" in rendered
    assert "Schema enforcement" in rendered
    assert "verified_live" in rendered
    assert "UI_COVERAGE.md" not in rendered


def test_js_user_template_graph_baseline_includes_test_file_field() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, mode="baseline", coverage_model="graph"),
    )
    assert "UI_GRAPH.json" in rendered
    assert "test_file" in rendered
    assert '"tested"' in rendered
    assert '"trigger"' in rendered
    assert '"actions"' in rendered
    assert "auto-dismissing notifications" in rendered
    assert "immediately redirect" in rendered
    assert "Consistency rule" in rendered
    assert "Schema enforcement" in rendered
    assert "UI_COVERAGE.md" not in rendered


def test_js_user_template_flat_discovery_uses_markdown_format() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, mode="discovery", coverage_model="flat"),
    )
    assert "UI_COVERAGE.md" in rendered
    assert "[ ]" in rendered and "[x]" in rendered
    assert "UI_GRAPH.json" not in rendered


def test_coverage_model_is_reserved_prompt_var() -> None:
    assert "coverage_model" in claude_code.RESERVED_PROMPT_VARS


# ---------------------------------------------------------------------------
# Feature-extraction mode
# ---------------------------------------------------------------------------

def test_js_system_template_feature_extraction_mode() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_SYSTEM_TEMPLATE,
        _js_context(None, mode="feature-extraction", coverage_model="graph"),
    )
    assert "feature-extraction agent" in rendered
    assert "UI_FEATURES.json" in rendered
    assert "Playwright" not in rendered
    assert "run them with" not in rendered


def test_js_user_template_feature_extraction_includes_schema() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, mode="feature-extraction", coverage_model="graph"),
    )
    assert "UI_FEATURES.json" in rendered
    assert '"features"' in rendered
    assert '"scenarios"' in rendered
    assert '"paths"' in rendered
    assert "preconditions" in rendered
    assert "expected_outcome" in rendered
    assert "related_nodes" in rendered
    assert "UI_COVERAGE.md" not in rendered
    assert "generate Playwright" not in rendered


def test_feature_extraction_mode_is_valid_cli_choice() -> None:
    args = build_parser().parse_args(
        ["--input-dir", ".", "--mode", "feature-extraction", "--coverage-model", "graph"]
    )
    assert args.mode == "feature-extraction"
    assert args.coverage_model == "graph"


# ---------------------------------------------------------------------------
# Graph-test-gen mode
# ---------------------------------------------------------------------------

def test_js_system_template_graph_test_gen_mode() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_SYSTEM_TEMPLATE,
        _js_context(None, mode="graph-test-gen", coverage_model="graph"),
    )
    assert "test generation agent" in rendered
    assert "UI_GRAPH.json" in rendered
    assert "npx playwright test" in rendered
    assert "Do NOT modify production code" in rendered


def test_js_user_template_graph_test_gen_reads_existing_graph() -> None:
    rendered = claude_code.render_template(
        claude_code.DEFAULT_USER_TEMPLATE,
        _js_context(None, mode="graph-test-gen", coverage_model="graph"),
    )
    assert "Read the existing `UI_GRAPH.json`" in rendered
    assert '"tested"' in rendered
    assert "rq6-graph-agent/" in rendered
    assert "rq6-agent/" not in rendered
    assert "trigger" in rendered
    assert "actions" in rendered
    assert "scan the repository" not in rendered
    assert "UI_FEATURES.json" not in rendered
    assert "UI_COVERAGE.md" not in rendered


def test_graph_test_gen_mode_is_valid_cli_choice() -> None:
    args = build_parser().parse_args(
        ["--input-dir", ".", "--mode", "graph-test-gen", "--coverage-model", "graph"]
    )
    assert args.mode == "graph-test-gen"
    assert args.coverage_model == "graph"
