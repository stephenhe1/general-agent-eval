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
