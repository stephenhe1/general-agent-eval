"""Tests for the mutation-effect probe.

The upstream injector sets its sentinel unconditionally after calling the mutation, so
"armed" proves the condition fired, not that the page changed. These tests pin the
mechanical wrapper that closes that gap: it must preserve the fault's own code
byte-for-byte, and it must refuse to guess when the upstream splice format changes.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from general_agent_eval.webtestpilot.bugs import (
    MUTATION_KEY,
    BugLoadError,
    instrument_mutation_probe,
)

TEMPLATE = """(() => {
  const STORAGE_KEY = "__BUG_INJECTOR_TRIGGERED__";
  const isConditionMet = () => {
    return document.querySelector('h1') !== null;
  };
  const onConditionMet = () => {
    const el = document.querySelector('#victim');
    if (el) { el.remove(); return true; }
    return false;
  };
  onConditionMet();
})();
"""

ORIGINAL_BODY_MARKER = "const el = document.querySelector('#victim');"


def test_probe_preserves_the_faults_own_code_verbatim():
    out = instrument_mutation_probe(TEMPLATE, label="t")
    assert ORIGINAL_BODY_MARKER in out
    assert "return true;" in out
    # The original declaration is renamed, not deleted, and the wrapper takes its name.
    assert "const __wtpOriginalOnConditionMet = () => {" in out
    assert out.count("const onConditionMet = () => {") == 1
    assert MUTATION_KEY in out


def test_probe_output_is_syntactically_valid_javascript(tmp_path):
    out = instrument_mutation_probe(TEMPLATE, label="t")
    path = tmp_path / "chk.js"
    path.write_text(out)
    try:
        result = subprocess.run(
            ["node", "--check", str(path)], capture_output=True, text=True
        )
    except FileNotFoundError:  # pragma: no cover - node absent in some environments
        pytest.skip("node not available")
    assert result.returncode == 0, result.stderr


def test_probe_refuses_when_the_splice_format_changes():
    """A silent no-wrap would make every fault report mutation state 'unknown'."""
    with pytest.raises(BugLoadError, match="cannot instrument"):
        instrument_mutation_probe("(() => { /* no mutation here */ })();", label="t")


def test_probe_refuses_ambiguous_input():
    doubled = TEMPLATE + TEMPLATE
    with pytest.raises(BugLoadError, match="appears 2 times"):
        instrument_mutation_probe(doubled, label="t")


def test_probe_is_applied_by_default_to_every_benchmark_bug():
    """All 100 faults must instrument; a format drift on any one is a hard error."""
    from general_agent_eval.webtestpilot.bugs import prepare_bug_script

    root = Path("/Users/stephenhe/Projects/WebTestPilot/WebTestPilot")
    bugs = sorted(root.glob("benchmark/*/bugs/*.js"))
    if not bugs:  # pragma: no cover - benchmark not present
        pytest.skip("WebTestPilot benchmark not available")
    for bug in bugs:
        script = prepare_bug_script(root, bug)
        assert MUTATION_KEY in script, bug.name


def test_mutation_probe_can_be_disabled_for_a_byte_exact_upstream_script():
    from general_agent_eval.webtestpilot.bugs import prepare_bug_script

    root = Path("/Users/stephenhe/Projects/WebTestPilot/WebTestPilot")
    bugs = sorted(root.glob("benchmark/*/bugs/*.js"))
    if not bugs:  # pragma: no cover
        pytest.skip("WebTestPilot benchmark not available")
    plain = prepare_bug_script(root, bugs[0], mutation_probe=False)
    assert MUTATION_KEY not in plain
