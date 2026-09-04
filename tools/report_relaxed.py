#!/usr/bin/env python3
"""Summarise the relaxed-trigger experiment.

The question this answers: when a fault that never fired is made to fire *and verifiably
change the page*, does the generated suite catch it?

Only faults with ``mutation_applied == true`` count as measurements. A fault that fired but
mutated nothing (``armed_no_effect``) proves only that the trigger was reached -- there was no
defect present, so the suite's silence says nothing about its assertions. Counting those as
misses would inflate the result in the tools' disfavour, which is the mirror of the mistake
the original campaign made.

Tier matters for attribution:
  tier1 -- only the trigger was relaxed; the mutation is byte-identical to the benchmark's, so
           the fault is WebTestPilot's own.
  tier2 -- the mutation also located its victim by literal and was relaxed too, so the fault's
           shape survives but the element it hits may differ. A variant, not the original.

Writes ``relaxed_summary.csv`` (per fault) and ``relaxed_by_run.csv`` (per run) next to the
results root, and prints the headline.

Usage: python tools/report_relaxed.py [--root results/wtp_relaxed]
"""
from __future__ import annotations

import argparse
import csv
import glob
import json
import os
from collections import Counter, defaultdict

BASELINES = {"claude-code-baseline": "A", "playwright-agents": "B"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="results/wtp_relaxed")
    args = ap.parse_args()

    tiers: dict[str, str] = {}
    manifest = os.path.join(args.root, "variant_manifest.csv")
    if os.path.exists(manifest):
        for row in csv.DictReader(open(manifest)):
            tiers[(row["app"], row["bug"])] = row["tier"]

    rows = []
    for baseline_dir, label in BASELINES.items():
        for verdict_path in sorted(
            glob.glob(os.path.join(args.root, baseline_dir, "*", "bugs", "*", "verdict.json"))
        ):
            parts = verdict_path.split(os.sep)
            app, bug = parts[-4], parts[-2]
            data = json.load(open(verdict_path))
            mutated = data.get("mutation_applied")
            detecting = ""
            evidence = data.get("evidence") or []
            if evidence:
                detecting = f"{evidence[0].get('file','')}::{evidence[0].get('title','')}"
            rows.append(
                {
                    "baseline": label,
                    "app": app,
                    "bug": bug,
                    "tier": tiers.get((app, bug), "?"),
                    "verdict": data.get("verdict"),
                    "armed": data.get("activated"),
                    "mutation_applied": mutated,
                    # The only rows that measure oracle strength.
                    "is_measurement": mutated is True,
                    "caught": data.get("verdict") == "caught",
                    "detecting_test": detecting,
                }
            )

    if not rows:
        print(f"no relaxed verdicts found under {args.root}")
        return 1

    out_dir = args.root
    with open(os.path.join(out_dir, "relaxed_summary.csv"), "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    per_run: dict[tuple[str, str], Counter] = defaultdict(Counter)
    for row in rows:
        key = (row["baseline"], row["app"])
        per_run[key]["faults"] += 1
        # Namespace the verdict tally so a verdict literally named "caught" cannot also
        # increment the measurement counter below -- that double-counted every catch.
        per_run[key]["verdict:" + str(row["verdict"])] += 1
        if row["is_measurement"]:
            per_run[key]["real_defects"] += 1
            if row["caught"]:
                per_run[key]["caught"] += 1

    run_rows = []
    for (baseline, app), counts in sorted(per_run.items()):
        real = counts["real_defects"]
        run_rows.append(
            {
                "baseline": baseline,
                "app": app,
                "variants_run": counts["faults"],
                "real_defects": real,
                "caught": counts["caught"],
                "detection_rate_on_real_defects": (
                    f"{counts['caught'] / real:.1%}" if real else "n/a"
                ),
                "oracle_miss": counts["verdict:oracle_miss"],
                "armed_no_effect": counts["verdict:armed_no_effect"],
                "not_activated": counts["verdict:not_activated"],
            }
        )
    with open(os.path.join(out_dir, "relaxed_by_run.csv"), "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(run_rows[0].keys()))
        writer.writeheader()
        writer.writerows(run_rows)

    header = (
        f"{'run':22s} {'variants':>8s} {'real':>5s} {'caught':>6s} "
        f"{'miss':>5s} {'no_eff':>6s} {'notact':>6s}"
    )
    print(header)
    print("-" * len(header))
    for row in run_rows:
        print(
            f"{row['baseline'] + ' / ' + row['app']:22s} {row['variants_run']:>8d} "
            f"{row['real_defects']:>5d} {row['caught']:>6d} {row['oracle_miss']:>5d} "
            f"{row['armed_no_effect']:>6d} {row['not_activated']:>6d}"
        )

    real = sum(r["real_defects"] for r in run_rows)
    caught = sum(r["caught"] for r in run_rows)
    print(f"\nREAL DEFECTS CREATED: {real}   CAUGHT: {caught}")
    if real:
        print(f"detection rate on verifiably real defects: {caught / real:.1%}")

    by_tier = Counter(r["tier"] for r in rows if r["is_measurement"])
    print("\nreal defects by tier:", dict(by_tier))
    print("  tier1 = WebTestPilot's own fault, trigger relaxed only")
    print("  tier2 = shape-preserving variant; victim element may differ")

    # Faults that still cannot be measured, and why -- reported, never dropped silently.
    unmeasured = [r for r in rows if not r["is_measurement"]]
    print(f"\nnot measurable ({len(unmeasured)} of {len(rows)} runs):")
    for verdict, count in Counter(str(r["verdict"]) for r in unmeasured).most_common():
        why = {
            "armed_no_effect": "fault fired but changed nothing -- needs DOM the suite never creates",
            "not_activated": "still did not fire -- remaining gate is not a content literal",
        }.get(verdict, "")
        print(f"   {verdict:18s} {count:3d}  {why}")
    print(f"\nwrote {os.path.join(out_dir, 'relaxed_summary.csv')}")
    print(f"wrote {os.path.join(out_dir, 'relaxed_by_run.csv')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
