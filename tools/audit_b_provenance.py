#!/usr/bin/env python3
"""Audit Baseline B (playwright-agents) suite provenance.

Two independent signals per app, because neither alone is conclusive:

1. STAMP    -- specs whose first line is a `// spec:` header. The Playwright generator
               agent's definition shows this header in an *example*, not as an enforced
               output contract, so presence is strong evidence the generator authored the
               file while absence is only weak evidence that it did not.
2. DELEGATE -- `task_started` records in the SDK transcript whose description names a
               planner/generator role ("Plan ...", "Generate ... from plan"). Direct
               evidence the main agent handed the work to a subagent.

A run is only reported as clean Baseline B when both signals agree. Emits CSV to stdout.

Usage: python tools/audit_b_provenance.py [results-root]
"""
import csv
import glob
import json
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "results/wtp_headtohead/playwright-agents"

GEN_RE = re.compile(r"generate\b.*\bfrom\b.*\bplan|playwright-test-generator", re.I)
PLAN_RE = re.compile(r"^plan\b|playwright-test-planner", re.I)

# Seeds are written by the harness, not the generator, so they never carry provenance.
NON_GENERATED = {"seed.spec.ts", "seed.spec.js"}


def spec_dir(app):
    """Prefer the frozen suite; fall back to the live workspace for in-flight runs."""
    for cand in (
        f"{ROOT}/{app}/generation/frozen",
        f"{ROOT}/{app}/generation/workspace/tests",
    ):
        if os.path.isdir(cand):
            return cand
    return None


def first_line(path):
    with open(path, errors="replace") as fh:
        return fh.readline()


rows = []
for app_path in sorted(glob.glob(f"{ROOT}/*/generation")):
    app = app_path.split("/")[-2]
    directory = spec_dir(app)
    specs = []
    if directory:
        specs = [
            p
            for p in sorted(glob.glob(f"{directory}/*.spec.ts"))
            if os.path.basename(p) not in NON_GENERATED
        ]
    stamped = sum(1 for p in specs if first_line(p).startswith("// spec:"))

    gen_tasks = plan_tasks = 0
    transcript = f"{app_path}/messages.jsonl"
    if os.path.exists(transcript):
        for line in open(transcript, errors="replace"):
            try:
                rec = json.loads(line)
            except Exception:
                continue
            if rec.get("subtype") != "task_started":
                continue
            desc = rec.get("data", {}).get("description") or ""
            if GEN_RE.search(desc):
                gen_tasks += 1
            elif PLAN_RE.search(desc):
                plan_tasks += 1

    if specs and stamped == len(specs) and gen_tasks:
        verdict = "clean"
    elif not stamped and not gen_tasks:
        verdict = "invalid-no-delegation"
    elif specs and stamped < len(specs):
        verdict = "hybrid-partial"
    else:
        verdict = "review"

    rows.append(
        {
            "app": app,
            "specs": len(specs),
            "stamped": stamped,
            "stamp_rate": f"{stamped / len(specs):.2f}" if specs else "",
            "planner_tasks": plan_tasks,
            "generator_tasks": gen_tasks,
            "spec_source": os.path.basename(directory) if directory else "none",
            "verdict": verdict,
        }
    )

writer = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
writer.writeheader()
for row in rows:
    writer.writerow(row)
