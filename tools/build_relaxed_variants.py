#!/usr/bin/env python3
"""Generate relaxed-trigger variants for the faults that never fired.

Target set: every (app, bug) whose verdict was ``not_activated`` with cause
``value_difference`` in `activation_causes.csv` -- the faults whose trigger demanded the
benchmark author's exact literals, so the injected script sat inert against a suite that
exercised the same scenario with its own data.

Writes variants to ``--out`` as ``<out>/<app>/<bug>.js`` plus an auditable
``variant_manifest.csv``. Nothing is committed and nothing lands inside the package: a
generation workspace must never be able to reach a bug file, relaxed or otherwise.

A variant here is a *candidate*. It only becomes a usable measurement once an evaluation
observes it both fire and change the DOM -- see the ``mutation_applied`` column the
evaluator now records. Firing alone is not enough, because a de-literalised mutation can
find no target and silently no-op.

Usage:
  python tools/build_relaxed_variants.py \
      --causes results/wtp_headtohead/activation_causes.csv \
      --out results/wtp_relaxed/prepared
"""
from __future__ import annotations

import argparse
import csv
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from general_agent_eval.webtestpilot.bugs import prepare_bug_script  # noqa: E402
from general_agent_eval.webtestpilot.variants import build_variant, write_variant  # noqa: E402

TARGET_CAUSES = {"value_difference"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--causes", type=Path, default=Path("results/wtp_headtohead/activation_causes.csv"))
    ap.add_argument("--out", type=Path, default=Path("results/wtp_relaxed/prepared"))
    ap.add_argument(
        "--wtp-root", type=Path, default=Path("/Users/stephenhe/Projects/WebTestPilot/WebTestPilot")
    )
    args = ap.parse_args()

    if not args.causes.is_file():
        sys.exit(f"cause audit not found: {args.causes}")

    targets: dict[tuple[str, str], set[str]] = {}
    for row in csv.DictReader(open(args.causes)):
        if row["verdict"] == "not_activated" and row["cause"] in TARGET_CAUSES:
            targets.setdefault((row["app"], row["bug_name"]), set()).add(row["baseline"])

    args.out.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, object]] = []
    tiers: Counter[str] = Counter()
    rejected: list[tuple[str, str, str]] = []
    diffs: list[str] = []
    tmp = Path(tempfile.mkdtemp())

    for (app, bug), baselines in sorted(targets.items()):
        bug_path = args.wtp_root / "benchmark" / app / "bugs" / f"{bug}.js"
        if not bug_path.is_file():
            rejected.append((app, bug, "benchmark bug file not found"))
            continue
        try:
            variant = build_variant(app, bug_path)
        except Exception as exc:  # noqa: BLE001 - recorded, not raised
            rejected.append((app, bug, f"transform failed: {exc}"))
            continue

        if not variant.changed:
            # No content gate to relax: this fault did not fail to fire for the reason the
            # cause audit assigned. Recorded rather than shipped, so the tier lists stay
            # honest about the audit's own misclassifications.
            rejected.append((app, bug, "no content literal to relax (cause misassigned)"))
            continue

        # A variant that will not splice or will not parse is worse than no variant: it
        # would inject nothing and read as `not_activated` all over again.
        probe = tmp / f"{app}_{bug}.js"
        probe.write_text(variant.text, "utf-8")
        try:
            script = prepare_bug_script(args.wtp_root, probe)
        except Exception as exc:  # noqa: BLE001
            rejected.append((app, bug, f"splice failed: {exc}"))
            continue
        check = tmp / "check.js"
        check.write_text(script, "utf-8")
        try:
            result = subprocess.run(
                ["node", "--check", str(check)], capture_output=True, text=True
            )
        except FileNotFoundError:
            result = None
        if result is not None and result.returncode != 0:
            first = next(
                (line for line in result.stderr.splitlines() if "Error" in line), "syntax error"
            )
            rejected.append((app, bug, f"invalid JS: {first[:80]}"))
            continue

        write_variant(variant, args.out)
        row = variant.to_row()
        row["baselines_affected"] = ",".join(sorted(baselines))
        rows.append(row)
        tiers[variant.tier] += 1
        diffs.append(f"### {app}/{bug}  [{variant.tier}]\n{variant.diff}\n")

    if rows:
        manifest = args.out.parent / "variant_manifest.csv"
        with manifest.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        (args.out.parent / "variant_diffs.md").write_text(
            "# Relaxed-trigger variant diffs\n\n"
            "Every edit made to every fault, for review. `tier1` = trigger only, mutation "
            "byte-identical to the benchmark's. `tier2` = the mutation also located its victim "
            "by literal and was relaxed too, so the fault's shape is preserved but the element "
            "it hits may differ.\n\n" + "\n".join(diffs),
            "utf-8",
        )
        print(f"wrote {manifest}")
        print(f"wrote {args.out.parent / 'variant_diffs.md'}")

    print(f"\ntarget faults (not_activated / value_difference): {len(targets)}")
    print(f"variants written: {len(rows)}   tiers: {dict(tiers)}")
    print(f"rejected: {len(rejected)}")
    for app, bug, why in rejected:
        print(f"   {app}/{bug}: {why}")

    by_app: Counter[str] = Counter(str(r["app"]) for r in rows)
    print("\nvariants per app:", dict(by_app))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
