#!/usr/bin/env python3
"""Detection measured only over ACTIVE faults -- those that actually fired.

`caught / 100` is not a measure of oracle strength on this benchmark: 126 of 206 evaluations
never armed at all, mostly because the fault's trigger demanded the benchmark author's exact
literals or a URL the suite never visited. Those rows carry no information about assertions.

This report keeps only faults that fired, and grades the evidence:

  VERIFIED   the fault fired AND a DOM signature taken either side of the mutation changed,
             so a real defect was demonstrably on the page. These come from the relaxed-trigger
             re-runs, which record `mutation_applied`.
  UNVERIFIED the fault fired during the original campaign, before `mutation_applied` existed.
             A real defect was probably present -- 31 of 35 armed faults (89%) did mutate once
             the check was added -- but it was not measured. Reported separately rather than
             pooled, because on the self-test app the same check overturned 6 of 7 misses.

Where the same (baseline, app, bug) appears in both sets the VERIFIED record wins: it is the
same suite against the same fault family, with better evidence.

Usage: python tools/report_fired_only.py
"""
from __future__ import annotations

import csv
import glob
from collections import Counter, defaultdict

OFFICIAL_GLOB = "results/wtp_headtohead/*/*/per_bug.csv"
RELAXED_SUMMARY = "results/wtp_relaxed/relaxed_summary.csv"
OUT = "results/wtp_headtohead/export/08_active_faults.csv"


def load() -> dict:
    """Return {(baseline, app, bug): record} for every fault that fired."""
    fired: dict[tuple[str, str, str], dict] = {}

    for path in sorted(glob.glob(OFFICIAL_GLOB)):
        baseline = "A" if "claude-code-baseline" in path else "B"
        app = path.split("/")[3]
        for row in csv.DictReader(open(path)):
            if row["activated"] != "True":
                continue
            fired[(baseline, app, row["bug_name"])] = {
                "baseline": baseline,
                "app": app,
                "bug": row["bug_name"],
                "source": "official",
                "evidence": "UNVERIFIED",
                "trigger": "as shipped",
                "tier": "",
                "verdict": row["verdict"],
                "caught": row["verdict"] == "caught",
                "detecting_test": row.get("detecting_test", ""),
            }

    # VERIFIED records overwrite UNVERIFIED ones for the same fault.
    for row in csv.DictReader(open(RELAXED_SUMMARY)):
        if row["mutation_applied"] != "True":
            continue
        fired[(row["baseline"], row["app"], row["bug"])] = {
            "baseline": row["baseline"],
            "app": row["app"],
            "bug": row["bug"],
            "source": "relaxed",
            "evidence": "VERIFIED",
            "trigger": "literal gate relaxed",
            "tier": row["tier"],
            "verdict": row["verdict"],
            "caught": row["verdict"] == "caught",
            "detecting_test": row.get("detecting_test", ""),
        }
    return fired


def main() -> int:
    fired = load()
    rows = sorted(fired.values(), key=lambda r: (r["baseline"], r["app"], r["bug"]))

    with open(OUT, "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    verified = [r for r in rows if r["evidence"] == "VERIFIED"]
    unverified = [r for r in rows if r["evidence"] != "VERIFIED"]

    print("DETECTION OVER ACTIVE FAULTS")
    print("total = faults observed to fire AND to change the page.")
    print("A fault that fired without changing anything put no defect on screen, so a")
    print("passing suite proves nothing; those are excluded, not counted as misses.")
    print("=" * 66)

    total = len(verified)
    caught = sum(1 for r in verified if r["caught"])
    print(f"\n  TOTAL (verified real defects): {total}")
    print(f"  CAUGHT:                       {caught}")
    print(f"  DETECTION RATE:               {caught / total:.1%}" if total else "")

    per: dict[tuple[str, str], Counter] = defaultdict(Counter)
    for r in verified:
        per[(r["baseline"], r["app"])]["total"] += 1
        per[(r["baseline"], r["app"])]["caught"] += r["caught"]

    print(f"\n  {'run':18s} {'total':>6s} {'caught':>7s} {'rate':>7s}")
    print("  " + "-" * 41)
    for (baseline, app), counts in sorted(per.items()):
        rate = counts["caught"] / counts["total"] if counts["total"] else 0
        print(
            f"  {baseline + ' / ' + app:18s} {counts['total']:>6d} "
            f"{counts['caught']:>7d} {rate:>7.1%}"
        )

    tier1 = [r for r in verified if r["tier"] == "tier1"]
    if tier1:
        c = sum(1 for r in tier1 if r["caught"])
        print(
            f"\n  strongest subset -- tier1 (WebTestPilot's own mutation, byte-identical,"
            f"\n  only the trigger literal relaxed):"
            f"\n    total={len(tier1)}  caught={c}  rate={c / len(tier1):.1%}"
        )

    # Held out of every figure above: fired during the original campaign, before the DOM
    # signature check existed, so it is unknown whether a defect was ever on the page.
    if unverified:
        uc = sum(1 for r in unverified if r["caught"])
        print(
            f"\n  EXCLUDED PENDING RE-RUN: {len(unverified)} faults fired in the original"
            f"\n  campaign before the page-change check existed ({uc} caught). Not counted"
            f"\n  above in either direction. Re-running them with the check active is what"
            f"\n  would move them into the table."
        )

    print("\n  caught faults (all, including excluded):")
    for r in rows:
        if r["caught"]:
            print(f"    {r['baseline']}/{r['app']}  {r['bug']}  [{r['evidence']}, {r['trigger']}]")
    print(f"\nwrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
