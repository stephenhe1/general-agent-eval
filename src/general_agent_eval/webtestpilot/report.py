"""Machine-readable results: per-test CSV, per-bug CSV, summary JSON/MD, review queue."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from pathlib import Path

from general_agent_eval.webtestpilot.classify import BugVerdict, CleanProfile, Verdict

PER_BUG_COLUMNS = [
    "app",
    "bug_name",
    "bug_path",
    "clean_suite_valid",
    "bug_activated",
    "buggy_suite_passed",
    "candidate_failure_count",
    "behavior_aligned_failure_count",
    "verdict",
    "review_required",
    "alignment_confidence",
    "detecting_test_file",
    "detecting_test_name",
    "failure_message",
    "nl_expectation",
    "notes",
]

PER_TEST_COLUMNS = [
    "app",
    "test_file",
    "test_name",
    "clean_status",
    "clean_pass_count",
    "clean_repetitions",
    "bugs_failed_under",
    "bugs_aligned_under",
]


@dataclass
class AppResult:
    app: str
    clean: CleanProfile
    verdicts: list[BugVerdict] = field(default_factory=list)
    generation: dict[str, object] = field(default_factory=dict)

    def counts(self) -> dict[str, int]:
        tally = {v.value: 0 for v in Verdict}
        for verdict in self.verdicts:
            tally[verdict.verdict.value] += 1
        return tally

    def metrics(self) -> dict[str, object]:
        tally = self.counts()
        num_bugs = len(self.verdicts)
        num_activated = sum(1 for v in self.verdicts if v.activated)
        num_caught = tally[Verdict.CAUGHT.value]
        num_incidental = tally[Verdict.INCIDENTAL_FAILURE.value]

        def ratio(numerator: int, denominator: int) -> float | None:
            return round(numerator / denominator, 4) if denominator else None

        return {
            "num_bugs": num_bugs,
            "num_activated": num_activated,
            "num_caught": num_caught,
            "num_oracle_miss": tally[Verdict.ORACLE_MISS.value],
            "num_not_activated": tally[Verdict.NOT_ACTIVATED.value],
            "num_incidental_failure": num_incidental,
            "num_environment_error": tally[Verdict.ENVIRONMENT_ERROR.value],
            "bug_activation_rate": ratio(num_activated, num_bugs),
            "conditional_fault_detection_rate": ratio(num_caught, num_activated),
            "end_to_end_fault_detection_rate": ratio(num_caught, num_bugs),
            "incidental_failure_rate": ratio(num_incidental, num_activated),
            "clean_stability_rate": round(self.clean.stability_rate, 4),
            "total_generated_tests": len(self.clean.status_by_test),
            "clean_stable_tests": len(self.clean.stable),
            "clean_failing_tests": len(self.clean.failing),
            "clean_flaky_tests": len(self.clean.flaky),
            "review_required_count": sum(1 for v in self.verdicts if v.review_required),
        }


def _aggregate(results: list[AppResult]) -> dict[str, object]:
    num_bugs = sum(len(r.verdicts) for r in results)
    num_activated = sum(1 for r in results for v in r.verdicts if v.activated)
    tally = {v.value: 0 for v in Verdict}
    for result in results:
        for key, value in result.counts().items():
            tally[key] += value
    total_tests = sum(len(r.clean.status_by_test) for r in results)
    stable_tests = sum(len(r.clean.stable) for r in results)

    def ratio(numerator: int, denominator: int) -> float | None:
        return round(numerator / denominator, 4) if denominator else None

    return {
        "num_bugs": num_bugs,
        "num_activated": num_activated,
        "num_caught": tally[Verdict.CAUGHT.value],
        "num_oracle_miss": tally[Verdict.ORACLE_MISS.value],
        "num_not_activated": tally[Verdict.NOT_ACTIVATED.value],
        "num_incidental_failure": tally[Verdict.INCIDENTAL_FAILURE.value],
        "num_environment_error": tally[Verdict.ENVIRONMENT_ERROR.value],
        "bug_activation_rate": ratio(num_activated, num_bugs),
        "conditional_fault_detection_rate": ratio(tally[Verdict.CAUGHT.value], num_activated),
        "end_to_end_fault_detection_rate": ratio(tally[Verdict.CAUGHT.value], num_bugs),
        "incidental_failure_rate": ratio(tally[Verdict.INCIDENTAL_FAILURE.value], num_activated),
        "clean_stability_rate": ratio(stable_tests, total_tests),
        "total_generated_tests": total_tests,
        "clean_stable_tests": stable_tests,
        "review_required_count": sum(1 for r in results for v in r.verdicts if v.review_required),
    }


def write_per_bug_csv(results: list[AppResult], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=PER_BUG_COLUMNS)
        writer.writeheader()
        for result in results:
            for verdict in result.verdicts:
                data = verdict.to_dict()
                best = verdict.detecting
                writer.writerow(
                    {
                        "app": data["app"],
                        "bug_name": data["bug_name"],
                        "bug_path": data["bug_path"],
                        "clean_suite_valid": data["clean_suite_valid"],
                        "bug_activated": data["activated"],
                        "buggy_suite_passed": data["buggy_suite_passed"],
                        "candidate_failure_count": data["candidate_failure_count"],
                        "behavior_aligned_failure_count": data["behavior_aligned_failure_count"],
                        "verdict": data["verdict"],
                        "review_required": data["review_required"],
                        "alignment_confidence": best.alignment_confidence if best else "",
                        "detecting_test_file": data["detecting_test_file"],
                        "detecting_test_name": data["detecting_test_name"],
                        "failure_message": str(data["failure_message"]).replace("\n", " ⏎ ")[:1000],
                        "nl_expectation": data["nl_expectation"],
                        "notes": " | ".join(verdict.notes),
                    }
                )


def write_per_test_csv(results: list[AppResult], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=PER_TEST_COLUMNS)
        writer.writeheader()
        for result in results:
            failed_under: dict[str, list[str]] = {}
            aligned_under: dict[str, list[str]] = {}
            for verdict in result.verdicts:
                for item in verdict.evidence:
                    failed_under.setdefault(item.test_key, []).append(verdict.bug.name)
                    if item.is_oracle_rejection:
                        aligned_under.setdefault(item.test_key, []).append(verdict.bug.name)
            for key, status in sorted(result.clean.status_by_test.items()):
                file_name, _, title = key.partition("::")
                writer.writerow(
                    {
                        "app": result.app,
                        "test_file": file_name,
                        "test_name": title,
                        "clean_status": status.value,
                        "clean_pass_count": result.clean.pass_counts.get(key, 0),
                        "clean_repetitions": result.clean.repetitions,
                        "bugs_failed_under": ";".join(sorted(failed_under.get(key, []))),
                        "bugs_aligned_under": ";".join(sorted(aligned_under.get(key, []))),
                    }
                )


def write_summary_json(results: list[AppResult], path: Path, *, meta: dict[str, object]) -> dict:
    payload = {
        "meta": meta,
        "overall": _aggregate(results),
        "per_app": {
            result.app: {
                **result.metrics(),
                "clean_profile": result.clean.to_dict(),
                "generation": result.generation,
            }
            for result in results
        },
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", "utf-8")
    return payload


def _fmt(value: object) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.1%}"
    return str(value)


def write_summary_md(results: list[AppResult], path: Path, *, meta: dict[str, object]) -> None:
    overall = _aggregate(results)
    provenance = str(meta.get("suite_provenance", "unknown"))
    is_selftest = bool(meta.get("is_selftest_target"))
    is_baseline = provenance.startswith("claude-code") and not is_selftest

    if is_baseline:
        heading = "# WebTestPilot injected-bug evaluation — Claude Code Web UI baseline"
        blurb = [
            "Autonomously generated Playwright suites, frozen before any bug was seen,",
            "run against WebTestPilot's injected faults.",
        ]
    else:
        heading = "# WebTestPilot injected-bug evaluation — HARNESS VALIDATION (not a baseline result)"
        reasons = []
        if is_selftest:
            reasons.append(
                "the target is the evaluator's self-test application, not a benchmark application"
            )
        if not provenance.startswith("claude-code"):
            reasons.append(f"the suite was not produced by an agent run (provenance: {provenance})")
        blurb = [
            "> **These numbers do not measure the Claude Code baseline.** They exist to",
            f"> validate the evaluation harness, because {'; and '.join(reasons)}.",
            "> Do not cite them as baseline fault-detection results.",
        ]

    lines: list[str] = [heading, "", *blurb, "", "## Provenance", ""]
    for key, value in meta.items():
        lines.append(f"- **{key}**: {value}")

    lines += [
        "",
        "## Headline",
        "",
        f"**End-to-end suite fault detection rate: "
        f"{_fmt(overall['end_to_end_fault_detection_rate'])}** "
        f"({overall['num_caught']}/{overall['num_bugs']} benchmark faults exposed)",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| A. Clean stability rate | {_fmt(overall['clean_stability_rate'])} "
        f"({overall['clean_stable_tests']}/{overall['total_generated_tests']} tests) |",
        f"| B. Bug activation rate | {_fmt(overall['bug_activation_rate'])} "
        f"({overall['num_activated']}/{overall['num_bugs']}) |",
        f"| C. Conditional fault detection rate | "
        f"{_fmt(overall['conditional_fault_detection_rate'])} "
        f"({overall['num_caught']}/{overall['num_activated']}) |",
        f"| D. End-to-end fault detection rate (primary) | "
        f"{_fmt(overall['end_to_end_fault_detection_rate'])} |",
        f"| E. Incidental failure rate | {_fmt(overall['incidental_failure_rate'])} |",
        "",
        "### Verdict counts",
        "",
        "| Verdict | Count |",
        "| --- | --- |",
        f"| caught | {overall['num_caught']} |",
        f"| oracle_miss | {overall['num_oracle_miss']} |",
        f"| not_activated | {overall['num_not_activated']} |",
        f"| incidental_failure | {overall['num_incidental_failure']} |",
        f"| environment_error | {overall['num_environment_error']} |",
        "",
        f"{overall['review_required_count']} verdict(s) flagged for manual "
        "behaviour-alignment review — see `review_queue.md`.",
        "",
        "## Per application",
        "",
        "| App | Tests | Clean stable | Bugs | Activated | Caught | Oracle miss | "
        "Not activated | Incidental | Env error | E2E detection |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for result in results:
        metrics = result.metrics()
        lines.append(
            f"| {result.app} | {metrics['total_generated_tests']} | "
            f"{metrics['clean_stable_tests']} | {metrics['num_bugs']} | "
            f"{metrics['num_activated']} | {metrics['num_caught']} | "
            f"{metrics['num_oracle_miss']} | {metrics['num_not_activated']} | "
            f"{metrics['num_incidental_failure']} | {metrics['num_environment_error']} | "
            f"{_fmt(metrics['end_to_end_fault_detection_rate'])} |"
        )

    lines += [
        "",
        "## Per bug",
        "",
        "| App | Bug | Activated | Verdict | Confidence | Detecting test | Review? |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for result in results:
        for verdict in result.verdicts:
            best = verdict.detecting
            lines.append(
                f"| {result.app} | `{verdict.bug.name}` | "
                f"{'yes' if verdict.activated else 'no'} | **{verdict.verdict.value}** | "
                f"{best.alignment_confidence if best else '—'} | "
                f"{(best.title[:60] if best else '—')} | "
                f"{'yes' if verdict.review_required else 'no'} |"
            )

    lines += [
        "",
        "## Reading these numbers",
        "",
        "- `not_activated` means the generated suite never drove the application into the",
        "  state the fault keys on, so the fault never fired. It is not an oracle failure,",
        "  but it still counts against the primary end-to-end metric: the suite did not",
        "  expose that benchmark fault.",
        "- `caught` requires an activated fault plus a *clean-stable* test failing on a",
        "  failed assertion. Timeouts and runtime errors are `incidental_failure`.",
        "- Verdicts are automatic. Any row with `Review? = yes` needs human confirmation",
        "  that the failing assertion detects the same behavioural property the fault",
        "  violated. Evidence for every failure is preserved under each bug's run dir.",
        "",
    ]
    path.write_text("\n".join(lines) + "\n", "utf-8")


def write_review_queue(results: list[AppResult], path: Path) -> None:
    """Auditable artifact for manual behaviour-alignment confirmation."""
    lines = [
        "# Behaviour-alignment review queue",
        "",
        "Each entry is an automatic verdict that needs human confirmation. For every",
        "candidate, compare the failing generated assertion against the behavioural",
        "property the injected fault violates. Locator or assertion style need not match",
        "the benchmark's own `ground_truth` — only the property under test matters.",
        "",
    ]
    total = 0
    for result in results:
        for verdict in result.verdicts:
            if not verdict.review_required:
                continue
            total += 1
            bug = verdict.bug
            lines += [
                f"## {result.app} / `{bug.name}` — auto verdict: **{verdict.verdict.value}**",
                "",
                f"- Bug script: `{bug.bug_path}`",
                f"- Activated: {'yes' if verdict.activated else 'no'}",
                f"- Benchmark NL expectation (final step): {bug.final_nl_expectation or '—'}",
                f"- Fault fingerprint literals: "
                f"{', '.join(f'`{t}`' for t in bug.alignment_tokens) or '—'}",
                f"- Evidence dir: `{verdict.run_dir or '—'}`",
                "",
                "Candidate failures:",
                "",
            ]
            if not verdict.evidence:
                lines += ["_(none)_", ""]
            for item in verdict.evidence:
                lines += [
                    f"- **{item.title}** (`{item.file}`)",
                    f"  - failure kind: `{item.kind.value}`, "
                    f"alignment confidence: `{item.alignment_confidence}`",
                    f"  - matched fault literals: "
                    f"{', '.join(f'`{m}`' for m in item.matched_literals) or '—'}",
                    f"  - fault fired during this test: "
                    f"{'yes' if item.activated_in_test else 'no'}",
                    "  - error:",
                    "",
                    "    ```",
                    *[f"    {line}" for line in item.error_message.splitlines()[:24]],
                    "    ```",
                    "",
                    "  - **Reviewer verdict:** `[ ] aligned  [ ] not aligned`",
                    "",
                ]
    if total == 0:
        lines.append("_No verdicts require manual review._")
    path.write_text("\n".join(lines) + "\n", "utf-8")
