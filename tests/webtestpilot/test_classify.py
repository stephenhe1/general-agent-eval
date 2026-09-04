"""Unit tests for the five-way verdict classifier and clean-stability profiling."""

from __future__ import annotations

from pathlib import Path

import pytest

from general_agent_eval.webtestpilot.bugs import BenchmarkBug
from general_agent_eval.webtestpilot.classify import (
    CleanStatus,
    FailureKind,
    Verdict,
    build_clean_profile,
    classify_bug,
    classify_failure_kind,
)
from general_agent_eval.webtestpilot.runner import SuiteRun, TestOutcome

ASSERTION_ERROR = (
    "Error: expect(locator).toContainText(expected) failed\n"
    "Locator: locator('.grid-card')\n"
    "- Expected substring  - Original Description\n"
    "+ Received string     + Bad Description\n"
)
TIMEOUT_ERROR = (
    "TimeoutError: locator.click: Timeout 15000ms exceeded.\n"
    "Call log:\n  - waiting for locator('button[name=\"Save\"]')\n"
)
RUNTIME_ERROR = "TypeError: Cannot read properties of undefined (reading 'title')"


def bug(name: str = "create_book", **kwargs) -> BenchmarkBug:
    defaults: dict = {
        "app": "bookstack",
        "name": name,
        "bug_path": Path(f"/benchmark/bookstack/bugs/{name}.js"),
        "effect_literals": ("Bad Description", "New Book"),
        "trigger_literals": (),
        "nl_expectations": ("Books list title and description stays consistent",),
        "final_nl_expectation": "Books list title and description stays consistent",
    }
    defaults.update(kwargs)
    return BenchmarkBug(**defaults)


def outcome(key: str, status: str, error: str = "") -> TestOutcome:
    file_name, _, title = key.partition("::")
    return TestOutcome(file=file_name, title=title, status=status, error_message=error)


def run(label: str, outcomes: list[TestOutcome], **kwargs) -> SuiteRun:
    suite = SuiteRun(label=label, exit_code=0, **kwargs)
    suite.outcomes = {item.key: item for item in outcomes}
    return suite


PASS = "a.spec.ts::strong oracle"
WEAK = "a.spec.ts::weak oracle"
BROKEN = "b.spec.ts::already broken"


def three_clean_runs(*, broken: bool = True) -> list[SuiteRun]:
    runs = []
    for index in range(1, 4):
        items = [outcome(PASS, "passed"), outcome(WEAK, "passed")]
        if broken:
            items.append(outcome(BROKEN, "failed", "boom"))
        runs.append(run(f"clean_{index}", items))
    return runs


# ------------------------------------------------------------------ failure kind


@pytest.mark.parametrize(
    ("error", "status", "expected"),
    [
        (ASSERTION_ERROR, "failed", FailureKind.ASSERTION),
        (TIMEOUT_ERROR, "failed", FailureKind.TIMEOUT),
        (RUNTIME_ERROR, "failed", FailureKind.RUNTIME),
        ("", "timedOut", FailureKind.TIMEOUT),
        ("something inscrutable", "failed", FailureKind.UNKNOWN),
    ],
)
def test_failure_kind(error: str, status: str, expected: FailureKind) -> None:
    assert classify_failure_kind(outcome(PASS, status, error)) is expected


def test_visibility_assertion_that_times_out_is_still_an_oracle() -> None:
    """A failed toBeVisible reports a timeout but is an oracle rejection."""
    error = (
        "Error: expect(locator).toBeVisible() failed\n"
        "Locator: getByRole('heading', { name: 'Total' })\n"
        "Timeout: 5000ms\n"
    )
    assert classify_failure_kind(outcome(PASS, "failed", error)) is FailureKind.ASSERTION


# --------------------------------------------------------------- clean profile


def test_clean_profile_separates_stable_failing_and_flaky() -> None:
    runs = [
        run("clean_1", [outcome(PASS, "passed"), outcome(WEAK, "passed"), outcome(BROKEN, "failed")]),
        run("clean_2", [outcome(PASS, "passed"), outcome(WEAK, "failed"), outcome(BROKEN, "failed")]),
        run("clean_3", [outcome(PASS, "passed"), outcome(WEAK, "passed"), outcome(BROKEN, "failed")]),
    ]
    profile = build_clean_profile(runs)
    assert profile.status_by_test[PASS] is CleanStatus.STABLE
    assert profile.status_by_test[WEAK] is CleanStatus.FLAKY
    assert profile.status_by_test[BROKEN] is CleanStatus.FAILING
    assert profile.stability_rate == pytest.approx(1 / 3)
    assert profile.valid


def test_test_missing_from_a_repetition_is_flaky_not_stable() -> None:
    runs = [
        run("clean_1", [outcome(PASS, "passed")]),
        run("clean_2", []),
        run("clean_3", [outcome(PASS, "passed")]),
    ]
    assert build_clean_profile(runs).status_by_test[PASS] is CleanStatus.FLAKY


# -------------------------------------------------------------------- verdicts


def test_caught_requires_activation_and_an_assertion_failure() -> None:
    clean = build_clean_profile(three_clean_runs())
    bug_run = run(
        "bug",
        [outcome(PASS, "failed", ASSERTION_ERROR), outcome(WEAK, "passed"), outcome(BROKEN, "failed", "boom")],
        activation={PASS: True},
    )
    verdict = classify_bug(bug(), bug_run, clean)
    assert verdict.verdict is Verdict.CAUGHT
    assert verdict.activated
    best = verdict.detecting
    assert best is not None and best.test_key == PASS
    # 'Bad Description' appears in the failure, so alignment is high confidence.
    assert best.matched_literals == ["Bad Description"]
    assert best.alignment_confidence == "high"
    assert not verdict.review_required


def test_caught_without_literal_evidence_is_flagged_for_review() -> None:
    clean = build_clean_profile(three_clean_runs(broken=False))
    generic = "Error: expect(locator).toHaveCount(expected) failed\n- Expected  - 3\n+ Received  + 2\n"
    bug_run = run("bug", [outcome(PASS, "failed", generic), outcome(WEAK, "passed")], activation={PASS: True})
    verdict = classify_bug(bug(), bug_run, clean)
    assert verdict.verdict is Verdict.CAUGHT
    assert verdict.detecting.alignment_confidence != "high"
    assert verdict.review_required


def test_oracle_miss_when_activated_but_nothing_fails() -> None:
    clean = build_clean_profile(three_clean_runs())
    bug_run = run(
        "bug",
        [outcome(PASS, "passed"), outcome(WEAK, "passed"), outcome(BROKEN, "failed", "boom")],
        activation={PASS: True},
    )
    verdict = classify_bug(bug(), bug_run, clean)
    assert verdict.verdict is Verdict.ORACLE_MISS
    assert verdict.activated


def test_not_activated_when_sentinel_never_fires() -> None:
    clean = build_clean_profile(three_clean_runs())
    bug_run = run("bug", [outcome(PASS, "passed"), outcome(WEAK, "passed"), outcome(BROKEN, "failed", "boom")])
    verdict = classify_bug(bug(), bug_run, clean)
    assert verdict.verdict is Verdict.NOT_ACTIVATED
    assert not verdict.activated


def test_incidental_failure_when_only_timeouts_and_runtime_errors() -> None:
    clean = build_clean_profile(three_clean_runs(broken=False))
    bug_run = run(
        "bug",
        [outcome(PASS, "failed", TIMEOUT_ERROR), outcome(WEAK, "failed", RUNTIME_ERROR)],
        activation={PASS: True, WEAK: True},
    )
    verdict = classify_bug(bug(), bug_run, clean)
    assert verdict.verdict is Verdict.INCIDENTAL_FAILURE
    assert verdict.aligned_failures == []
    assert verdict.review_required


def test_clean_failing_test_cannot_detect_a_bug() -> None:
    """A test already failing on the clean app is excluded from evidence."""
    clean = build_clean_profile(three_clean_runs())
    bug_run = run(
        "bug",
        [outcome(PASS, "passed"), outcome(WEAK, "passed"), outcome(BROKEN, "failed", ASSERTION_ERROR)],
        activation={BROKEN: True},
    )
    verdict = classify_bug(bug(), bug_run, clean)
    assert verdict.verdict is Verdict.ORACLE_MISS
    assert verdict.evidence == []
    assert [item.test_key for item in verdict.excluded_failures] == [BROKEN]


def test_environment_error_when_buggy_run_has_infrastructure_failure() -> None:
    clean = build_clean_profile(three_clean_runs())
    bug_run = run("bug", [], infrastructure_error="playwright produced no JSON report")
    verdict = classify_bug(bug(), bug_run, clean)
    assert verdict.verdict is Verdict.ENVIRONMENT_ERROR


def test_environment_error_when_clean_baseline_is_invalid() -> None:
    broken_clean = build_clean_profile(
        [run("clean_1", [], infrastructure_error="suite executed no tests")]
    )
    assert not broken_clean.valid
    bug_run = run("bug", [outcome(PASS, "failed", ASSERTION_ERROR)], activation={PASS: True})
    verdict = classify_bug(bug(), bug_run, broken_clean)
    assert verdict.verdict is Verdict.ENVIRONMENT_ERROR
    assert not verdict.clean_suite_valid


# ------------------------------------------------------- armed but no DOM change


def test_armed_but_unmutated_is_not_blamed_on_the_suite():
    """A fault that fires and mutates nothing must not be scored ``oracle_miss``.

    The upstream injector sets its sentinel whenever the condition matched, even if the
    mutation then found no target. Calling that an oracle miss faults the tests for
    failing to see a defect that was never on the page.
    """
    clean = build_clean_profile(three_clean_runs(broken=False))
    buggy = run(
        "bug",
        [outcome(PASS, "passed"), outcome(WEAK, "passed")],
        activation={PASS: True},
        mutation_applied={PASS: False},
    )
    verdict = classify_bug(bug(), buggy, clean)
    assert verdict.verdict is Verdict.ARMED_NO_EFFECT
    assert verdict.activated is True
    assert verdict.mutation_applied is False
    assert any("left the DOM unchanged" in n for n in verdict.notes)


def test_armed_and_mutated_with_no_failure_is_still_an_oracle_miss():
    clean = build_clean_profile(three_clean_runs(broken=False))
    buggy = run(
        "bug",
        [outcome(PASS, "passed"), outcome(WEAK, "passed")],
        activation={PASS: True},
        mutation_applied={PASS: True},
    )
    verdict = classify_bug(bug(), buggy, clean)
    assert verdict.verdict is Verdict.ORACLE_MISS
    assert verdict.mutation_applied is True


def test_unknown_mutation_state_stays_an_oracle_miss_but_is_flagged():
    """Older runs carry no probe data; the verdict holds, with the gap recorded."""
    clean = build_clean_profile(three_clean_runs(broken=False))
    buggy = run(
        "bug",
        [outcome(PASS, "passed"), outcome(WEAK, "passed")],
        activation={PASS: True},
    )
    verdict = classify_bug(bug(), buggy, clean)
    assert verdict.verdict is Verdict.ORACLE_MISS
    assert verdict.mutation_applied is None
    assert any("probe unreadable" in n for n in verdict.notes)


def test_a_real_catch_is_unaffected_by_the_mutation_probe():
    """Positive control: mutation observed, assertion rejected it -> still caught."""
    clean = build_clean_profile(three_clean_runs(broken=False))
    buggy = run(
        "bug",
        [outcome(PASS, "failed", ASSERTION_ERROR), outcome(WEAK, "passed")],
        activation={PASS: True},
        mutation_applied={PASS: True},
    )
    verdict = classify_bug(bug(), buggy, clean)
    assert verdict.verdict is Verdict.CAUGHT


def test_mutation_true_wins_over_false_across_tests():
    """The fault fires once per context; a later test seeing no flag must not erase it."""
    clean = build_clean_profile(three_clean_runs(broken=False))
    buggy = run(
        "bug",
        [outcome(PASS, "passed"), outcome(WEAK, "passed")],
        activation={PASS: True, WEAK: True},
        mutation_applied={PASS: False, WEAK: True},
    )
    verdict = classify_bug(bug(), buggy, clean)
    assert verdict.mutation_applied is True
    assert verdict.verdict is Verdict.ORACLE_MISS
