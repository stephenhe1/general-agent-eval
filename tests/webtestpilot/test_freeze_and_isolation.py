"""Tests for suite freezing, mechanical instrumentation, and workspace isolation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from general_agent_eval.webtestpilot import workspace as ws
from general_agent_eval.webtestpilot.freeze import (
    FIXTURE_BASENAME,
    FreezeError,
    find_generated_dir,
    freeze_suite,
    instrument_suite,
    verify_frozen,
)

SPEC = """import { test, expect } from '@playwright/test';

test('example', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Home/);
});
"""


@pytest.fixture()
def generated(tmp_path: Path) -> Path:
    workspace = tmp_path / "workspace"
    generated_dir = workspace / "tests" / "rq6-agent"
    (generated_dir / "nested").mkdir(parents=True)
    (generated_dir / "a.spec.ts").write_text(SPEC, "utf-8")
    (generated_dir / "nested" / "b.spec.ts").write_text(SPEC, "utf-8")
    (generated_dir / "helper.ts").write_text("export const BASE = '/';\n", "utf-8")
    # Pre-existing developer tests that must never be picked up.
    (workspace / "tests" / "legacy").mkdir(parents=True)
    (workspace / "tests" / "legacy" / "old.spec.ts").write_text(SPEC, "utf-8")
    # A vendored package that also has a matching directory name.
    vendored = workspace / "node_modules" / "pkg" / "rq6-agent"
    vendored.mkdir(parents=True)
    (vendored / "c.spec.ts").write_text(SPEC, "utf-8")
    return workspace


def test_find_generated_dir_ignores_node_modules_and_legacy_tests(generated: Path) -> None:
    found = find_generated_dir(generated)
    assert found == generated / "tests" / "rq6-agent"


def test_find_generated_dir_errors_when_absent(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    with pytest.raises(FreezeError, match="no generated test directory"):
        find_generated_dir(tmp_path)


def test_freeze_hashes_every_file_and_detects_tampering(generated: Path, tmp_path: Path) -> None:
    suite = freeze_suite(find_generated_dir(generated), tmp_path / "out" / "frozen")
    assert suite.spec_count == 2
    assert len(suite.files) == 3
    assert verify_frozen(suite) == []

    (suite.root / "a.spec.ts").write_text(SPEC + "// tampered\n", "utf-8")
    assert any("modified" in problem for problem in verify_frozen(suite))

    (suite.root / "sneaked.spec.ts").write_text(SPEC, "utf-8")
    assert any("unexpected file" in problem for problem in verify_frozen(suite))


def test_freeze_refuses_to_overwrite(generated: Path, tmp_path: Path) -> None:
    destination = tmp_path / "out" / "frozen"
    freeze_suite(find_generated_dir(generated), destination)
    with pytest.raises(FreezeError, match="already exists"):
        freeze_suite(find_generated_dir(generated), destination)


def test_instrumentation_redirects_imports_at_every_depth(
    generated: Path, tmp_path: Path
) -> None:
    suite = freeze_suite(find_generated_dir(generated), tmp_path / "out" / "frozen")
    instrumented = instrument_suite(suite, generated / "__wtp_eval")

    top = (instrumented.root / "a.spec.ts").read_text("utf-8")
    nested = (instrumented.root / "nested" / "b.spec.ts").read_text("utf-8")
    assert f"'./{FIXTURE_BASENAME}'" in top
    assert f"'../{FIXTURE_BASENAME}'" in nested
    assert "@playwright/test" not in top
    assert "@playwright/test" not in nested

    # The frozen original is untouched, and its hashes still verify.
    assert "@playwright/test" in (suite.root / "a.spec.ts").read_text("utf-8")
    assert verify_frozen(suite) == []

    # Fixture and config are placed where node can resolve @playwright/test.
    assert (instrumented.root / f"{FIXTURE_BASENAME}.ts").is_file()
    assert instrumented.config == generated / "wtp.config.ts"
    assert instrumented.config.is_file()

    meta = json.loads((suite.root.parent / "instrumentation.json").read_text("utf-8"))
    assert meta["rewrite_total"] == 2


def test_instrumentation_is_byte_identical_across_repeat_builds(
    generated: Path, tmp_path: Path
) -> None:
    """Clean and buggy arms must share one instrumented tree, so it must be stable."""
    suite = freeze_suite(find_generated_dir(generated), tmp_path / "out" / "frozen")
    first = instrument_suite(suite, generated / "__wtp_eval")
    digest_one = (first.root / "a.spec.ts").read_bytes()
    second = instrument_suite(suite, generated / "__wtp_eval")
    assert (second.root / "a.spec.ts").read_bytes() == digest_one


def test_instrumentation_fails_loudly_when_nothing_imports_playwright(
    tmp_path: Path,
) -> None:
    workspace = tmp_path / "workspace"
    generated_dir = workspace / "rq6-agent"
    generated_dir.mkdir(parents=True)
    (generated_dir / "a.spec.ts").write_text("test('noop', () => {});\n", "utf-8")
    suite = freeze_suite(generated_dir, tmp_path / "frozen")
    with pytest.raises(FreezeError, match="rewrote no imports"):
        instrument_suite(suite, workspace / "__wtp_eval")


# ------------------------------------------------------------------- isolation


def test_built_workspace_is_clean_and_carries_operating_info(tmp_path: Path) -> None:
    root = ws.build_workspace("bookstack", tmp_path / "workspace")
    audit = ws.audit_workspace(root, guarantee="host")
    assert audit.clean, audit.to_dict()
    assert audit.scanned_files >= 3

    notes = (root / "APP_NOTES.md").read_text("utf-8")
    # Legitimate operating information the agent needs.
    assert "admin@admin.com" in notes
    assert "http://localhost:8081" in notes
    assert "1280x720" in notes
    # No benchmark material.
    assert "ground_truth" not in notes
    assert "isConditionMet" not in notes


def test_audit_flags_leaked_bug_script(tmp_path: Path) -> None:
    root = ws.build_workspace("bookstack", tmp_path / "workspace")
    (root / "leak.js").write_text(
        "const isConditionMet = () => true;\n", "utf-8"
    )
    audit = ws.audit_workspace(root, guarantee="host")
    assert not audit.clean
    kinds = {finding.kind for finding in audit.findings}
    assert "forbidden_marker" in kinds


def test_audit_flags_leaked_benchmark_spec(tmp_path: Path) -> None:
    root = ws.build_workspace("bookstack", tmp_path / "workspace")
    (root / "comment.yaml").write_text(
        "steps:\n- action: click\n  ground_truth: |\n    expect(page)\n", "utf-8"
    )
    audit = ws.audit_workspace(root, guarantee="host")
    assert not audit.clean
    assert any("ground_truth" in finding.detail for finding in audit.findings)


def test_transcript_audit_detects_benchmark_access(tmp_path: Path) -> None:
    transcript = tmp_path / "messages.jsonl"
    transcript.write_text(
        json.dumps(
            {
                "type": "tool_use",
                "input": {"file_path": "/Users/x/WebTestPilot/benchmark/bookstack/bugs/comment.js"},
            }
        )
        + "\n",
        "utf-8",
    )
    audit = ws.audit_transcript(transcript)
    assert not audit.clean
    assert any(finding.kind == "benchmark_path_reference" for finding in audit.findings)


def test_transcript_audit_passes_on_innocuous_transcript(tmp_path: Path) -> None:
    transcript = tmp_path / "messages.jsonl"
    transcript.write_text(
        json.dumps({"type": "text", "text": "Exploring http://localhost:8081/books"}) + "\n",
        "utf-8",
    )
    assert ws.audit_transcript(transcript).clean


def test_transcript_audit_reports_missing_transcript(tmp_path: Path) -> None:
    audit = ws.audit_transcript(tmp_path / "absent.jsonl")
    assert not audit.clean
    assert audit.findings[0].kind == "missing_transcript"


# ------------------------------------------------------------- path resolution


def test_cli_resolves_relative_path_arguments() -> None:
    """Relative path args must become absolute at the CLI boundary.

    Regression cover: Playwright is launched with cwd=<workspace>, so a relative
    --results-root produced a doubled config path
    (<workspace>/<results-root>/.../wtp.config.ts) and every run failed with
    "no JSON report", which the classifier reported as environment_error.
    """
    from general_agent_eval.webtestpilot.cli import _absolutize, build_parser

    args = _absolutize(
        build_parser().parse_args(
            [
                "--results-root",
                "results/webtestpilot_baseline",
                "--run-dir",
                "some/relative/run",
                "--app",
                "bookstack",
                "evaluate",
            ]
        )
    )
    for name in ("results_root", "run_dir", "wtp_root", "output_dir"):
        value = getattr(args, name)
        assert value.is_absolute(), f"{name} stayed relative: {value}"


def test_run_suite_absolutizes_paths_before_launching(tmp_path: Path, monkeypatch) -> None:
    """run_suite must hand Playwright absolute paths even if given relative ones."""
    from general_agent_eval.webtestpilot import runner as rn

    captured: dict[str, object] = {}

    class _Result:
        returncode = 0
        stdout = ""
        stderr = ""

    def fake_run(command, **kwargs):  # noqa: ANN001
        captured["command"] = command
        captured["env"] = kwargs.get("env", {})
        captured["cwd"] = kwargs.get("cwd")
        return _Result()

    monkeypatch.setattr(rn.subprocess, "run", fake_run)
    monkeypatch.chdir(tmp_path)

    (tmp_path / "ws").mkdir()
    (tmp_path / "ws" / "__wtp_eval").mkdir()
    (tmp_path / "ws" / "wtp.config.ts").write_text("//", "utf-8")

    rn.run_suite(
        label="clean_1",
        instrumented_dir=Path("ws/__wtp_eval"),
        config_path=Path("ws/wtp.config.ts"),
        project_dir=Path("ws"),
        base_url="http://localhost:8081",
        output_dir=Path("out/run_1"),
    )

    config_arg = captured["command"][captured["command"].index("--config") + 1]
    assert Path(config_arg).is_absolute()
    env = captured["env"]
    for key in ("WTP_TEST_DIR", "WTP_ARTIFACT_DIR", "WTP_JSON_REPORT", "WTP_SENTINEL_LOG"):
        assert Path(env[key]).is_absolute(), f"{key} relative: {env[key]}"
    assert Path(str(captured["cwd"])).is_absolute()


# --------------------------------------------------- transcript audit performance


def test_transcript_audit_is_linear_on_very_long_lines(tmp_path: Path) -> None:
    """A huge single-line JSONL entry must audit in well under a second.

    Regression cover for a real stall: the original pattern combined a leading
    `[^\\s"']*` with alternatives of the same shape, which backtracks quadratically.
    Real agent transcripts contain single lines of ~400k characters (embedded Playwright
    output), where that cost was minutes per line. It pinned a generation run at 98% CPU
    for 26 minutes after the agent had already finished, and looked exactly like a hang.
    """
    import time

    # No marker present, which is the worst case for a backtracking matcher.
    filler = "x" * 200_000 + "/some/deep/path/without/markers/" * 3_000
    transcript = tmp_path / "messages.jsonl"
    transcript.write_text(
        json.dumps({"type": "tool_result", "content": filler}) + "\n", "utf-8"
    )
    assert len(transcript.read_text()) > 250_000

    started = time.monotonic()
    audit = ws.audit_transcript(transcript)
    elapsed = time.monotonic() - started

    assert elapsed < 1.0, f"transcript audit took {elapsed:.1f}s on one long line"
    assert audit.clean


def test_transcript_audit_still_finds_markers_in_a_long_line(tmp_path: Path) -> None:
    """Speed must not have been bought by giving up detection."""
    buried = (
        "y" * 150_000
        + " /Users/x/WebTestPilot/benchmark/bookstack/bugs/comment.js "
        + "z" * 150_000
    )
    transcript = tmp_path / "messages.jsonl"
    transcript.write_text(json.dumps({"content": buried}) + "\n", "utf-8")

    audit = ws.audit_transcript(transcript)
    assert not audit.clean
    detail = " ".join(f.detail for f in audit.findings)
    assert "WebTestPilot" in detail or "/bugs/" in detail


def test_legitimate_app_credentials_are_not_flagged_as_leakage(tmp_path: Path) -> None:
    """Indico's admin password is the string 'webtestpilot'. That is app data, not leakage.

    Regression cover: the marker list once contained the bare lowercase 'webtestpilot', so a
    correctly built Indico workspace failed its own pre-generation audit and the run aborted.
    PrestaShop has the same collision via PS_FOLDER_ADMIN=/webtestpilot/.
    """
    root = ws.build_workspace("indico", tmp_path / "workspace")
    notes = (root / "APP_NOTES.md").read_text("utf-8")
    assert "webtestpilot" in notes, "the Indico password must still be provided to the agent"

    audit = ws.audit_workspace(root, guarantee="container")
    assert audit.clean, f"legitimate credentials flagged as leakage: {audit.to_dict()}"


def test_the_repository_name_is_still_a_marker(tmp_path: Path) -> None:
    """Narrowing the marker must not stop real benchmark paths being detected."""
    root = ws.build_workspace("indico", tmp_path / "workspace")
    (root / "leak.md").write_text(
        "see /Users/x/WebTestPilot/benchmark/indico/bugs/create_meeting.js\n", "utf-8"
    )
    audit = ws.audit_workspace(root, guarantee="container")
    assert not audit.clean
    assert any("WebTestPilot" in f.detail or "/bugs/" in f.detail for f in audit.findings)


# ------------------------------------------------- relaxed-trigger fault variants


def test_variant_drops_content_gate_but_keeps_existence_requirement():
    """`=== "Books"` becomes `!= null`, not `true`.

    Relaxing to `true` would fire the fault on every page, turning a conditional fault
    into an always-on one and changing what the experiment measures. `!= null` keeps the
    structural requirement (with `?.` a missing element still yields undefined) while
    dropping only the content requirement.
    """
    from general_agent_eval.webtestpilot.variants import build_variant

    source = (
        "// BEGIN isConditionMet\n"
        "const isConditionMet = () => {\n"
        "  return document.querySelector('h1.list-heading')?.textContent.trim() === 'Books';\n"
        "};\n"
        "// END isConditionMet\n"
        "// BEGIN onConditionMet\n"
        "const onConditionMet = () => {\n"
        "  document.querySelector('.grid-card')?.remove();\n"
        "};\n"
        "// END onConditionMet\n"
    )
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "delete_book.js"
        path.write_text(source)
        variant = build_variant("bookstack", path)

    assert "!= null" in variant.text
    assert "'Books'" not in variant.text
    assert "true;" not in variant.text
    # Mutation untouched -> tier 1, attributable to the benchmark's own fault.
    assert variant.tier == "tier1"
    assert variant.removed_from_condition == ["Books"]
    assert variant.removed_from_mutation == []


def test_variant_never_touches_visit_count_gating():
    """sessionStorage comparisons encode a tool-side obstacle and must survive.

    A single test can satisfy a visit counter by navigating away and returning; none did.
    Neutralising it would credit the generators for a gap that is genuinely theirs.
    """
    from general_agent_eval.webtestpilot.variants import build_variant

    source = (
        "// BEGIN isConditionMet\n"
        "const isConditionMet = () => {\n"
        "  const prev = sessionStorage.getItem('__prev_condition__') === 'true';\n"
        "  const here = document.querySelector('h1')?.textContent.trim() === 'Books';\n"
        "  return !prev && here;\n"
        "};\n"
        "// END isConditionMet\n"
        "// BEGIN onConditionMet\n"
        "const onConditionMet = () => { document.querySelector('p')?.remove(); };\n"
        "// END onConditionMet\n"
    )
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "delete_book.js"
        path.write_text(source)
        variant = build_variant("bookstack", path)

    # The storage line is preserved verbatim...
    assert "sessionStorage.getItem('__prev_condition__') === 'true'" in variant.text
    # ...while the content gate on the next line is relaxed.
    assert "!= null" in variant.text
    assert variant.removed_from_condition == ["Books"]


def test_variant_marks_mutation_edits_as_tier2():
    from general_agent_eval.webtestpilot.variants import build_variant

    source = (
        "// BEGIN isConditionMet\n"
        "const isConditionMet = () => document.querySelector('h4') !== null;\n"
        "// END isConditionMet\n"
        "// BEGIN onConditionMet\n"
        "const onConditionMet = () => {\n"
        "  const h = Array.from(document.querySelectorAll('h4'))\n"
        "    .find(x => x.textContent.trim() === 'January 2025');\n"
        "  h?.nextElementSibling?.remove();\n"
        "};\n"
        "// END onConditionMet\n"
    )
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "create_meeting.js"
        path.write_text(source)
        variant = build_variant("indico", path)

    assert variant.tier == "tier2"
    assert variant.removed_from_mutation == ["January 2025"]


def test_clean_profile_round_trips_for_reuse():
    """--reuse-clean-profile depends on this restoring the stable/failing/flaky split."""
    from general_agent_eval.webtestpilot.classify import CleanProfile, CleanStatus

    original = CleanProfile(
        repetitions=3,
        status_by_test={
            "a.spec.ts::ok": CleanStatus.STABLE,
            "a.spec.ts::broken": CleanStatus.FAILING,
        },
        run_failure_counts=[1, 1, 1],
    )
    restored = CleanProfile.from_dict(original.to_dict())
    assert restored.stable == original.stable
    assert restored.failing == original.failing
    assert restored.flaky == original.flaky
    assert restored.repetitions == 3
