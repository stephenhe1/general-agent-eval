#!/usr/bin/env python3
"""Rebuild per-application result files from the preserved per-bug verdicts.

Why this exists: `evaluate` writes per_bug.csv / per_test.csv / summary.json at the
*results-root*. Running several applications under one root -- which is what a per-baseline
layout does -- means each run overwrites the previous application's aggregates. The per-bug
verdicts under <app>/bugs/*/verdict.json are per-application and were never overwritten, so the
aggregates can be rebuilt from them losslessly. Writes into each <app>/ directory.
"""

from __future__ import annotations

import csv
import glob
import json
import os
import sys

APPS = ("bookstack", "invoiceninja", "indico", "prestashop")


def consolidate(app_dir: str) -> dict | None:
    verdicts = sorted(glob.glob(os.path.join(app_dir, "bugs", "*", "verdict.json")))
    if not verdicts:
        return None

    rows = [json.load(open(v)) for v in verdicts]
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    activated = sum(1 for r in rows if r["activated"])
    caught = counts.get("caught", 0)

    profile_path = os.path.join(app_dir, "clean", "clean_profile.json")
    profile = json.load(open(profile_path)) if os.path.exists(profile_path) else {}

    def ratio(n: int, d: int) -> float | None:
        return round(n / d, 4) if d else None

    summary = {
        "app": os.path.basename(app_dir),
        "num_bugs": len(rows),
        "num_activated": activated,
        "num_caught": caught,
        "num_oracle_miss": counts.get("oracle_miss", 0),
        "num_not_activated": counts.get("not_activated", 0),
        "num_incidental_failure": counts.get("incidental_failure", 0),
        "num_environment_error": counts.get("environment_error", 0),
        "bug_activation_rate": ratio(activated, len(rows)),
        "conditional_fault_detection_rate": ratio(caught, activated),
        "end_to_end_fault_detection_rate": ratio(caught, len(rows)),
        "total_generated_tests": profile.get("total_tests"),
        "clean_stable_tests": profile.get("clean_stable"),
        "clean_flaky_tests": profile.get("clean_flaky"),
        "clean_stability_rate": profile.get("clean_stability_rate"),
        "rebuilt_from": "bugs/*/verdict.json",
    }
    with open(os.path.join(app_dir, "summary.json"), "w") as handle:
        json.dump(summary, handle, indent=2)
        handle.write("\n")

    with open(os.path.join(app_dir, "per_bug.csv"), "w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            ["bug_name", "verdict", "activated", "candidate_failures",
             "aligned_failures", "detecting_test", "notes"]
        )
        for r in rows:
            writer.writerow([
                r["bug_name"], r["verdict"], r["activated"],
                r["candidate_failure_count"], r["behavior_aligned_failure_count"],
                r.get("detecting_test_name", ""), " | ".join(r.get("notes") or []),
            ])
    return summary


def main(roots: list[str]) -> int:
    print(f"{'SUBJECT':42s} {'TESTS':>5} {'STABLE':>6} {'ARMED':>9} {'CAUGHT':>6}")
    grand = [0, 0, 0]
    for root in roots:
        for app in APPS:
            app_dir = os.path.join(root, app)
            s = consolidate(app_dir)
            if not s:
                continue
            label = os.path.relpath(app_dir).replace("results/", "")
            print(
                f"{label:42s} {str(s['total_generated_tests']):>5} "
                f"{str(s['clean_stable_tests']):>6} "
                f"{s['num_activated']}/{s['num_bugs']:<7} {s['num_caught']:>6}"
            )
            grand[0] += s["num_bugs"]
            grand[1] += s["num_activated"]
            grand[2] += s["num_caught"]
    print(f"\nTOTAL: {grand[0]} bug-evaluations, {grand[1]} armed, {grand[2]} caught")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or [
        "results/webtestpilot_baseline",
        "results/wtp_headtohead/claude-code-baseline",
        "results/wtp_headtohead/playwright-agents",
    ]))
