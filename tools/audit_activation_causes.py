#!/usr/bin/env python3
"""Classify WHY each `not_activated` fault failed to arm.

`not_activated` is the dominant verdict on this benchmark, but it lumps together causes that
belong to different parties. This audit separates them by reading each fault's actual
`isConditionMet` body out of the prepared bug script and comparing its requirements against
the frozen suite.

Requirements are extracted as two kinds of string literal, after stripping CSS-selector
arguments (`querySelector*`, `closest`, `matches`) so selectors are not mistaken for content:

  PATH   literals beginning with "/" OR carrying a query string ("?order=product.name.asc")
         -- a navigation requirement. Query strings count as navigation because reaching
         them means visiting a URL, not typing different data: prestashop's
         buyer_sort_products_* faults gate on `location.search.includes("?order=...")`,
         which no suite satisfies, and mislabelling those as content coupling attributed a
         coverage gap to the benchmark.
  VALUE  every other literal          -- a content requirement ("January 2025", "New Meeting")

Cause assignment for a fault that did not arm:

  coverage_gap     no navigation call in the suite targets a required path -- the suite
                   never went there. TOOL-side.
  navigation_depth the condition counts visits in sessionStorage. That storage survives
                   page.goto() inside one test, so a single test that leaves the trigger
                   path and returns satisfies it. Reachable; the suite simply never wrote
                   a there-and-back flow. TOOL-side.
  value_difference every required path is navigated to, but the condition also demands
                   literal content. The suite exercised the scenario and differed only in
                   the data it used. BENCHMARK-side coupling.
  unexplained      paths navigated, no content or state requirement found, still did not
                   arm. Needs manual reading.
  indeterminate    no condition body / no literals extractable; needs manual reading.

CAVEATS, stated plainly:

* Coverage is judged from navigation calls (`goto`, `waitForURL`, `toHaveURL`), not from the
  path string appearing anywhere in the file. An earlier version matched anywhere and so
  credited invoiceninja with visiting `/invoices` when that string was a REST-API endpoint in
  an API-only suite. Even so, a navigation call in the source is not proof the test reached
  that state at runtime, so `value_difference` may still be mildly overcounted.
* `navigation_depth` is deliberately attributed TOOL-side. The visit counters live in
  `sessionStorage`, which survives `page.goto()` within a single test, so one test that leaves
  the trigger path and returns satisfies them. Verified for bookstack `create_book`: no test in
  either suite navigates to `/books` twice, though nothing stopped it. Only cross-*test*
  accumulation is blocked by Playwright's context isolation, and no condition here needs that.

The export's counterfactual `B'` row is NOT an activation rate. It is an upper bound on how
many faults could arm if the suite happened to use the benchmark's own literals. Report it
beside Metric B, never merged into it.

Usage: python tools/audit_activation_causes.py [--root results/wtp_headtohead] [--out FILE]
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import re
import sys

BASELINES = {"claude-code-baseline": "A", "playwright-agents": "B"}

# Calls whose string arguments are selectors, not content.
SELECTOR_CALLS = re.compile(
    r"\b(?:querySelectorAll|querySelector|closest|matches|getElementsBy\w+)\s*\(\s*"
    r"(?P<q>[\"'`])(?:\\.|(?!\1).)*?\1\s*\)",
    re.S,
)
STRING_LITERAL = re.compile(r"(?P<q>[\"'])(?P<val>(?:\\.|(?!\1).)*)\1", re.S)

# Web-storage calls: their string arguments are bookkeeping keys and stored scalars used to
# count visits across navigations, NOT content a test would type. Counting them as content
# literals misfiles multi-visit triggers as "value_difference".
STORAGE_CALLS = re.compile(
    r"\b(?:sessionStorage|localStorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\((?P<args>[^)]*)\)",
    re.S,
)
# Dunder-style bookkeeping keys, and stored scalars that are not real page content.
STATE_KEY = re.compile(r"^__.*__$")
NON_CONTENT = {"true", "false", "null", "undefined"}
CONDITION = re.compile(
    r"(?:const|let|var)\s+isConditionMet\s*=\s*(?:\([^)]*\)|\w+)\s*=>\s*\{"
    r"|function\s+isConditionMet\s*\([^)]*\)\s*\{"
)


def condition_body(source: str) -> str | None:
    """Return the isConditionMet body by brace matching from its opening brace."""
    m = CONDITION.search(source)
    if not m:
        return None
    start = source.index("{", m.start())
    depth = 0
    for i in range(start, len(source)):
        c = source[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return source[start + 1 : i]
    return None


def requirements(body: str):
    """Return (paths, content_values, uses_visit_state)."""
    uses_state = bool(STORAGE_CALLS.search(body))
    stripped = SELECTOR_CALLS.sub(" ", body)
    stripped = STORAGE_CALLS.sub(" ", stripped)
    paths, values = [], []
    for m in STRING_LITERAL.finditer(stripped):
        val = m.group("val").strip()
        if not val or len(val) < 2:
            continue
        if STATE_KEY.match(val) or val.lower() in NON_CONTENT:
            uses_state = True
            continue
        is_navigation = val.startswith("/") or "?" in val or "&" in val
        (paths if is_navigation else values).append(val)
    # De-duplicate, preserve order.
    return list(dict.fromkeys(paths)), list(dict.fromkeys(values)), uses_state


# Only these count as the suite actually *navigating* somewhere. Matching a bare path
# anywhere in the file conflates REST-API endpoint strings with UI navigation -- which is
# exactly what happened for invoiceninja, whose suite tests the API and never drives the UI.
NAV_CALL = re.compile(
    r"(?:goto|waitForURL|toHaveURL|hasURL)\s*\(\s*[\"'`/^]*(?P<url>[^\"'`)$]*)", re.S
)


def suite_navigations(app_dir: str):
    """Return (nav_targets, full_text) for the frozen suite."""
    for sub in ("generation/frozen", "generation/workspace/tests"):
        d = os.path.join(app_dir, sub)
        if not os.path.isdir(d):
            continue
        text = "\n".join(
            open(p, errors="replace").read()
            for p in glob.glob(os.path.join(d, "*.spec.*"))
        )
        navs = {m.group("url").strip() for m in NAV_CALL.finditer(text)}
        return navs, text
    return set(), ""


def path_navigated(path: str, navs: set) -> bool:
    """True when some navigation target starts with (or equals) the required path."""
    p = path.rstrip("/") or "/"
    for n in navs:
        n = n.strip()
        if not n:
            continue
        n_norm = "/" + n.lstrip("/") if not n.startswith("http") else n
        if n_norm.rstrip("/") == p or n_norm.startswith(p + "/") or p in n_norm:
            return True
    return False


def prepared_scripts(root: str, app: str) -> dict:
    """Prepared scripts are identical across baselines; take whichever run has them."""
    for baseline in BASELINES:
        d = os.path.join(root, baseline, app, "bugs", "_prepared")
        if os.path.isdir(d):
            return {
                os.path.basename(p)[:-3]: p for p in glob.glob(os.path.join(d, "*.js"))
            }
    return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="results/wtp_headtohead")
    ap.add_argument("--out", default="results/wtp_headtohead/activation_causes.csv")
    args = ap.parse_args()

    rows = []
    for baseline_dir, label in BASELINES.items():
        for app_dir in sorted(glob.glob(os.path.join(args.root, baseline_dir, "*"))):
            app = os.path.basename(app_dir)
            bug_csv = os.path.join(app_dir, "per_bug.csv")
            if not os.path.isfile(bug_csv):
                continue
            scripts = prepared_scripts(args.root, app)
            navs, specs = suite_navigations(app_dir)

            for rec in csv.DictReader(open(bug_csv)):
                bug, verdict = rec["bug_name"], rec["verdict"]
                path = scripts.get(bug)
                body = condition_body(open(path, errors="replace").read()) if path else None
                paths, values, uses_state = (
                    requirements(body) if body else ([], [], False)
                )
                paths_present = [p for p in paths if path_navigated(p, navs)]

                if verdict != "not_activated":
                    cause = ""
                elif not body:
                    cause = "indeterminate"
                elif paths and not paths_present:
                    cause = "coverage_gap"
                elif uses_state and not values:
                    # A sessionStorage visit counter. sessionStorage survives page.goto()
                    # within a single test, so one test that leaves and returns to the
                    # trigger path satisfies this. Reachable -- the suite simply never
                    # wrote a there-and-back flow. TOOL-side, not benchmark-side.
                    cause = "navigation_depth"
                elif values:
                    cause = "value_difference"
                elif paths_present:
                    cause = "unexplained"
                else:
                    cause = "indeterminate"

                rows.append(
                    {
                        "baseline": label,
                        "app": app,
                        "bug_name": bug,
                        "verdict": verdict,
                        "cause": cause,
                        "required_paths": " | ".join(paths),
                        "paths_found_in_suite": " | ".join(paths_present),
                        "required_values": " | ".join(values),
                        "n_required_values": len(values),
                        "uses_visit_state": uses_state,
                    }
                )

    if not rows:
        sys.exit("no per_bug.csv found")

    with open(args.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # Console summary per run.
    print(f"wrote {args.out} ({len(rows)} rows)\n")
    hdr = (f"{'run':22s} {'not_act':>8s} {'value_diff':>11s} {'coverage':>9s} "
           f"{'nav_depth':>10s} {'unexpl':>7s} {'indet':>6s}")
    print(hdr)
    print("-" * len(hdr))
    seen = {}
    for r in rows:
        key = f"{r['baseline']} / {r['app']}"
        d = seen.setdefault(key, {"not_activated": 0})
        if r["verdict"] == "not_activated":
            d["not_activated"] += 1
            d[r["cause"]] = d.get(r["cause"], 0) + 1
    for key, d in seen.items():
        print(
            f"{key:22s} {d['not_activated']:>8d} {d.get('value_difference',0):>11d} "
            f"{d.get('coverage_gap',0):>9d} {d.get('navigation_depth',0):>10d} "
            f"{d.get('unexplained',0):>7d} {d.get('indeterminate',0):>6d}"
        )


if __name__ == "__main__":
    main()
