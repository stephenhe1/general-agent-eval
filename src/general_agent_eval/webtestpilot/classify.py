"""Clean-stability analysis and five-way bug verdict classification.

The classifier is deliberately conservative and fully auditable:

* ``caught`` requires an activated fault, a *clean-stable* test failing, and that
  failure being an oracle rejection (a failed ``expect``) rather than the test
  falling over. Every such verdict is emitted with its evidence and flagged for
  human confirmation — the automatic signal narrows the review set, it does not
  replace review.
* A failure that is a timeout, a locator error, or an uncaught exception is
  ``incidental_failure``, never ``caught``.
* Source-level comparison against the benchmark's own ``ground_truth`` is never
  performed; a generated oracle is free to use any locator or assertion style.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

from general_agent_eval.webtestpilot.bugs import BenchmarkBug
from general_agent_eval.webtestpilot.runner import SuiteRun, TestOutcome


class Verdict(str, Enum):
    CAUGHT = "caught"
    ORACLE_MISS = "oracle_miss"
    NOT_ACTIVATED = "not_activated"
    # Condition matched but the mutation changed nothing, so there was no defect on the
    # page to detect. Kept separate from ORACLE_MISS, which blames the suite: scoring a
    # no-op fault as a miss would fault the tests for not seeing an absent bug.
    ARMED_NO_EFFECT = "armed_no_effect"
    INCIDENTAL_FAILURE = "incidental_failure"
    ENVIRONMENT_ERROR = "environment_error"


class CleanStatus(str, Enum):
    STABLE = "stable"
    FAILING = "failing"
    FLAKY = "flaky"
    MISSING = "missing"


# A failed Playwright assertion — an oracle rejecting observed state.
_ASSERTION_RE = re.compile(
    r"(?:expect\(|Expected(?: string| value| pattern| substring)?:|"
    r"Received(?: string| value| array)?:|toBe|toEqual|toContain|toHaveText|"
    r"toHaveValue|toHaveCount|toHaveTitle|toHaveURL|toMatchAriaSnapshot|"
    r"toBeVisible|toBeHidden|toBeChecked|assertion failed)",
    re.IGNORECASE,
)
# The test itself broke: it never got far enough to judge behaviour.
_TIMEOUT_RE = re.compile(
    r"(?:Timeout .* exceeded|TimeoutError|waiting for locator|"
    r"locator\.\w+: Timeout|exceeded while running|Target (?:page|closed))",
    re.IGNORECASE,
)
_RUNTIME_RE = re.compile(
    r"(?:TypeError|ReferenceError|SyntaxError|ERR_CONNECTION|net::ERR|"
    r"ECONNREFUSED|browserType\.launch|Protocol error)",
    re.IGNORECASE,
)


class FailureKind(str, Enum):
    ASSERTION = "assertion"
    TIMEOUT = "timeout"
    RUNTIME = "runtime"
    UNKNOWN = "unknown"


def classify_failure_kind(outcome: TestOutcome) -> FailureKind:
    blob = f"{outcome.error_message}\n{outcome.error_stack}"
    if not blob.strip():
        return FailureKind.TIMEOUT if outcome.status == "timedOut" else FailureKind.UNKNOWN
    # A visibility assertion that timed out is still an oracle verdict, so check
    # the assertion shape before the generic timeout shape.
    if _ASSERTION_RE.search(blob):
        return FailureKind.ASSERTION
    if _TIMEOUT_RE.search(blob):
        return FailureKind.TIMEOUT
    if _RUNTIME_RE.search(blob):
        return FailureKind.RUNTIME
    return FailureKind.UNKNOWN


_WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9'&.$-]{3,}")
_STOPWORDS = frozenset(
    """the and for with that this from into then than when where which while
    should shall must page contains present shown show list item items view
    click clicked button link text title heading value after before initial
    current equal equals plus exactly only same other others structural content
    changes change added addition user users detail details need check""".split()
)


def _content_words(text: str) -> set[str]:
    return {
        word.lower()
        for word in _WORD_RE.findall(text or "")
        if word.lower() not in _STOPWORDS
    }


@dataclass
class FailureEvidence:
    """One clean-stable test failing under injection, with alignment signal."""

    test_key: str
    file: str
    title: str
    status: str
    kind: FailureKind
    error_message: str
    error_stack: str
    attachments: list[str] = field(default_factory=list)
    matched_literals: list[str] = field(default_factory=list)
    matched_expectation_words: list[str] = field(default_factory=list)
    activated_in_test: bool = False

    @property
    def is_oracle_rejection(self) -> bool:
        return self.kind is FailureKind.ASSERTION

    @property
    def alignment_confidence(self) -> str:
        """How strongly this failure looks like it detected *this* fault."""
        if not self.is_oracle_rejection:
            return "none"
        if self.matched_literals:
            return "high"
        if self.activated_in_test and self.matched_expectation_words:
            return "medium"
        if self.activated_in_test:
            return "low"
        return "low"

    def to_dict(self) -> dict[str, object]:
        return {
            "test_key": self.test_key,
            "file": self.file,
            "title": self.title,
            "status": self.status,
            "failure_kind": self.kind.value,
            "is_oracle_rejection": self.is_oracle_rejection,
            "alignment_confidence": self.alignment_confidence,
            "matched_literals": self.matched_literals,
            "matched_expectation_words": self.matched_expectation_words,
            "activated_in_test": self.activated_in_test,
            "error_message": self.error_message,
            "error_stack": self.error_stack,
            "attachments": self.attachments,
        }


@dataclass
class CleanProfile:
    """Per-test behaviour of the frozen suite across the clean repetitions."""

    repetitions: int
    status_by_test: dict[str, CleanStatus] = field(default_factory=dict)
    pass_counts: dict[str, int] = field(default_factory=dict)
    seen_counts: dict[str, int] = field(default_factory=dict)
    run_failure_counts: list[int] = field(default_factory=list)
    infrastructure_errors: list[str] = field(default_factory=list)

    @property
    def all_tests(self) -> list[str]:
        return sorted(self.status_by_test)

    @property
    def stable(self) -> set[str]:
        return {k for k, v in self.status_by_test.items() if v is CleanStatus.STABLE}

    @property
    def failing(self) -> set[str]:
        return {k for k, v in self.status_by_test.items() if v is CleanStatus.FAILING}

    @property
    def flaky(self) -> set[str]:
        return {k for k, v in self.status_by_test.items() if v is CleanStatus.FLAKY}

    @property
    def valid(self) -> bool:
        return not self.infrastructure_errors and bool(self.status_by_test)

    @property
    def stability_rate(self) -> float:
        total = len(self.status_by_test)
        return len(self.stable) / total if total else 0.0

    def to_dict(self) -> dict[str, object]:
        return {
            "repetitions": self.repetitions,
            "total_tests": len(self.status_by_test),
            "clean_stable": len(self.stable),
            "clean_failing": len(self.failing),
            "clean_flaky": len(self.flaky),
            "clean_stability_rate": round(self.stability_rate, 4),
            "suite_failure_counts_per_run": self.run_failure_counts,
            "infrastructure_errors": self.infrastructure_errors,
            "status_by_test": {k: v.value for k, v in self.status_by_test.items()},
        }

    @classmethod
    def from_dict(cls, data: dict) -> CleanProfile:
        """Rebuild a profile persisted by :meth:`to_dict`.

        ``pass_counts`` / ``seen_counts`` are not serialised; they are only used while
        building a profile from runs, and every consumer of a restored profile reads
        ``status_by_test`` instead. Reused profiles are hash-guarded by the caller
        against the frozen suite they describe.
        """
        return cls(
            repetitions=int(data.get("repetitions", 0)),
            status_by_test={
                key: CleanStatus(value)
                for key, value in (data.get("status_by_test") or {}).items()
            },
            run_failure_counts=list(data.get("suite_failure_counts_per_run") or []),
            infrastructure_errors=list(data.get("infrastructure_errors") or []),
        )


def build_clean_profile(runs: list[SuiteRun]) -> CleanProfile:
    """Classify every generated test as stable / failing / flaky on the clean app.

    Tests are never removed here: the suite is frozen and a test's instability is
    itself a reported result.
    """
    profile = CleanProfile(repetitions=len(runs))
    for run in runs:
        if run.infrastructure_error:
            profile.infrastructure_errors.append(f"{run.label}: {run.infrastructure_error}")
        profile.run_failure_counts.append(len(run.failures))
        for key, outcome in run.outcomes.items():
            profile.seen_counts[key] = profile.seen_counts.get(key, 0) + 1
            if outcome.ok:
                profile.pass_counts[key] = profile.pass_counts.get(key, 0) + 1

    for key, seen in profile.seen_counts.items():
        passes = profile.pass_counts.get(key, 0)
        if seen < len(runs):
            # Did not even appear in every repetition: treat as unstable.
            profile.status_by_test[key] = CleanStatus.FLAKY
        elif passes == seen:
            profile.status_by_test[key] = CleanStatus.STABLE
        elif passes == 0:
            profile.status_by_test[key] = CleanStatus.FAILING
        else:
            profile.status_by_test[key] = CleanStatus.FLAKY

    return profile


@dataclass
class BugVerdict:
    bug: BenchmarkBug
    verdict: Verdict
    activated: bool
    clean_suite_valid: bool
    buggy_suite_passed: bool
    # None = the mutation probe was unreadable for this run, so activation is confirmed
    # but the DOM change was never verified.
    mutation_applied: bool | None = None
    evidence: list[FailureEvidence] = field(default_factory=list)
    excluded_failures: list[FailureEvidence] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    run_dir: Path | None = None

    @property
    def candidate_failures(self) -> list[FailureEvidence]:
        return self.evidence

    @property
    def aligned_failures(self) -> list[FailureEvidence]:
        return [e for e in self.evidence if e.is_oracle_rejection]

    @property
    def detecting(self) -> FailureEvidence | None:
        ranked = sorted(
            self.aligned_failures,
            key=lambda e: {"high": 0, "medium": 1, "low": 2, "none": 3}[e.alignment_confidence],
        )
        return ranked[0] if ranked else None

    @property
    def review_required(self) -> bool:
        """Whether a human must confirm behavioural alignment for this verdict."""
        if self.verdict is Verdict.CAUGHT:
            best = self.detecting
            return best is None or best.alignment_confidence != "high"
        if self.verdict is Verdict.INCIDENTAL_FAILURE:
            return True
        return False

    def to_dict(self) -> dict[str, object]:
        best = self.detecting
        return {
            "app": self.bug.app,
            "bug_name": self.bug.name,
            "bug_path": str(self.bug.bug_path),
            "verdict": self.verdict.value,
            "verdict_source": "auto",
            "review_required": self.review_required,
            "activated": self.activated,
            "mutation_applied": self.mutation_applied,
            "clean_suite_valid": self.clean_suite_valid,
            "buggy_suite_passed": self.buggy_suite_passed,
            "candidate_failure_count": len(self.candidate_failures),
            "behavior_aligned_failure_count": len(self.aligned_failures),
            "detecting_test_file": best.file if best else "",
            "detecting_test_name": best.title if best else "",
            "alignment_confidence": best.alignment_confidence if best else "",
            "failure_message": (best.error_message[:2000] if best else ""),
            "nl_expectation": self.bug.final_nl_expectation,
            "alignment_tokens": list(self.bug.alignment_tokens),
            "notes": self.notes,
            "evidence": [e.to_dict() for e in self.evidence],
            "excluded_failures": [e.to_dict() for e in self.excluded_failures],
            "run_dir": str(self.run_dir) if self.run_dir else "",
        }


def classify_bug(
    bug: BenchmarkBug,
    bug_run: SuiteRun,
    clean: CleanProfile,
    *,
    run_dir: Path | None = None,
) -> BugVerdict:
    """Assign one of the five verdicts to a single injected fault."""
    notes: list[str] = []

    if not clean.valid:
        return BugVerdict(
            bug=bug,
            verdict=Verdict.ENVIRONMENT_ERROR,
            activated=False,
            clean_suite_valid=False,
            buggy_suite_passed=False,
            notes=["clean baseline invalid: " + "; ".join(clean.infrastructure_errors)],
            run_dir=run_dir,
        )

    if bug_run.infrastructure_error:
        return BugVerdict(
            bug=bug,
            verdict=Verdict.ENVIRONMENT_ERROR,
            activated=bug_run.activated,
            clean_suite_valid=True,
            buggy_suite_passed=False,
            notes=[f"buggy run infrastructure error: {bug_run.infrastructure_error}"],
            run_dir=run_dir,
        )

    activated = bug_run.activated
    mutated = bug_run.mutated
    expectation_words = _content_words(" ".join(bug.nl_expectations))
    literals = bug.alignment_tokens

    evidence: list[FailureEvidence] = []
    excluded: list[FailureEvidence] = []

    for key, outcome in sorted(bug_run.outcomes.items()):
        if outcome.ok:
            continue
        blob = f"{outcome.error_message}\n{outcome.error_stack}"
        blob_lower = blob.lower()
        item = FailureEvidence(
            test_key=key,
            file=outcome.file,
            title=outcome.title,
            status=outcome.status,
            kind=classify_failure_kind(outcome),
            error_message=outcome.error_message,
            error_stack=outcome.error_stack,
            attachments=outcome.attachments,
            matched_literals=[lit for lit in literals if lit.lower() in blob_lower],
            matched_expectation_words=sorted(expectation_words & _content_words(blob))[:12],
            activated_in_test=bool(bug_run.activation.get(key)),
        )
        status = clean.status_by_test.get(key, CleanStatus.MISSING)
        if status is CleanStatus.STABLE:
            evidence.append(item)
        else:
            excluded.append(item)
            notes.append(
                f"failure in non-clean-stable test excluded ({status.value}): {key}"
            )

    buggy_passed = not bug_run.failures

    if not activated:
        verdict = Verdict.NOT_ACTIVATED
        notes.append(
            "fault never satisfied its injection condition; the generated suite did not "
            "exercise the triggering scenario (counts as not detected end-to-end)"
        )
        if evidence:
            notes.append(
                f"{len(evidence)} clean-stable test(s) failed anyway, unrelated to the fault"
            )
    elif mutated is False:
        verdict = Verdict.ARMED_NO_EFFECT
        notes.append(
            "fault activated but its mutation left the DOM unchanged (mutation probe "
            "reported no change): the injected code found no target, so no defect was "
            "present for the suite to detect. Not attributable to oracle strength."
        )
        if evidence:
            notes.append(
                f"{len(evidence)} clean-stable test(s) failed anyway, unrelated to the fault"
            )
    elif not evidence:
        verdict = Verdict.ORACLE_MISS
        notes.append(
            "fault activated but no clean-stable generated test failed: the suite exercised "
            "the buggy behaviour and accepted it"
        )
        if mutated is None:
            notes.append(
                "mutation probe unreadable for this run: activation is confirmed but the "
                "DOM change was not verified"
            )
    elif any(e.is_oracle_rejection for e in evidence):
        verdict = Verdict.CAUGHT
    else:
        verdict = Verdict.INCIDENTAL_FAILURE
        notes.append(
            "clean-stable test(s) failed but only via timeout/runtime errors, not an "
            "assertion rejecting the observed state"
        )

    return BugVerdict(
        bug=bug,
        verdict=verdict,
        activated=activated,
        mutation_applied=mutated,
        clean_suite_valid=True,
        buggy_suite_passed=buggy_passed,
        evidence=evidence,
        excluded_failures=excluded,
        notes=notes,
        run_dir=run_dir,
    )
