#!/usr/bin/env python3
"""Could the frozen suite's assertions have caught each fault, had it armed?

This is the question `not_activated` leaves open. A fault that never armed tells us nothing
about oracle strength -- unless we inspect what the fault *would* have done and ask whether
the suite asserts on the thing it damages.

For each fault we read `onConditionMet` (the mutation) and classify:

MUTATION KIND
  remove      element deleted            -- catchable by a visibility assertion on it
  insert      element added              -- NOT catchable by visibility; needs a count or
                                           an explicit "must not exist" assertion
  text        textContent/innerHTML set  -- catchable by a text assertion on it
  attr        attribute/href/src changed -- catchable only by asserting that attribute
  style       style/class toggled        -- catchable only by asserting appearance

VICTIM TOKENS -- distinctive ids/classes/strings the mutation touches, generic tags dropped.

Then we look at the suite's `expect(...)` calls:

  victim_mentioned      a victim token appears inside some assertion region. NOTE: this does
                        NOT predict detection. Calibrated against the 43 faults that actually
                        armed, 31 carried this label and 0 of them were caught (precision 0%),
                        while the single real catch was labelled `victim_not_asserted`. The
                        label means "the suite looks at that thing somewhere", not "the suite
                        would reject the change" -- assertions here are overwhelmingly
                        `toBeVisible`, which a mutated-but-still-present element satisfies.
  needs_count_missing   the mutation inserts an element and the suite has no count assertion
                        anywhere -- structurally blind no matter what values were used.
  victim_not_asserted   no assertion mentions the victim.
  indeterminate         victim tokens too generic to match (bare div/li/ul), or no mutation
                        body found.

LIMITS, stated plainly and measured: this is static analysis of source text, and its positive
signal DOES NOT WORK. See the calibration above -- `victim_mentioned` has 0% precision on the
faults where we know the answer. Do not use this audit to claim a fault "would have been
caught".

What survives calibration is the structural half, which needs no token matching:

  * `mutation_kind == "insert"` is undetectable by a visibility assertion -- adding a phantom
    element leaves every existing element visible. Only a count assertion or an explicit
    "must not exist" check rejects it. Count assertions are nearly absent from these suites
    (0, 11, 1, 4, 0 across the five, against 46-98 `toBeVisible` each), so insertions are
    structurally invisible to them regardless of what values the tests used.
  * The empirical answer to "were the assertions capable?" is already measured directly:
    of 43 faults that really armed, 1 was caught.

Usage: python tools/audit_oracle_capability.py [--root results/wtp_headtohead] [--out FILE]
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import re
import sys

BASELINES = {"claude-code-baseline": "A", "playwright-agents": "B"}

GENERIC = {
    "div", "span", "li", "ul", "ol", "p", "a", "h1", "h2", "h3", "h4", "h5", "h6",
    "table", "tr", "td", "th", "img", "button", "input", "form", "section", "nav",
    "header", "footer", "main", "label", "small", "strong", "em", "br", "hr", "body",
}

MUTATIONS = [
    ("insert", re.compile(r"appendChild|insertBefore|insertAdjacent|createElement|prepend\(|\.after\(|\.before\(")),
    ("remove", re.compile(r"\.remove\(\)|removeChild|\.innerHTML\s*=\s*[\"'`]\s*[\"'`]|\.textContent\s*=\s*[\"'`]\s*[\"'`]")),
    ("text", re.compile(r"\.(?:textContent|innerText|innerHTML)\s*=")),
    ("attr", re.compile(r"setAttribute|removeAttribute|\.(?:href|src|value|title|alt)\s*=")),
    ("style", re.compile(r"\.style\.|classList\.(?:add|remove|toggle)|hidden\s*=")),
]

SELECTOR_ARG = re.compile(
    r"(?:querySelectorAll|querySelector|closest|matches)\s*\(\s*[\"'`]([^\"'`]+)[\"'`]"
)
ASSIGNED_STR = re.compile(
    r"\.(?:textContent|innerText|innerHTML|value|title|alt|href|src)\s*=\s*[\"'`]([^\"'`]{2,})[\"'`]"
)
EQ_STR = re.compile(r"(?:===|==|includes\s*\(|trim\(\)\s*===)\s*[\"'`]([^\"'`]{2,})[\"'`]")
EXPECT_CALL = re.compile(r"expect\s*\(", re.S)
COUNT_ASSERT = re.compile(r"toHaveCount|\.count\(\)|toHaveLength")


def body_of(source: str, name: str):
    m = re.search(rf"(?:const|let|var)\s+{name}\s*=\s*(?:\([^)]*\)|\w+)\s*=>\s*\{{"
                  rf"|function\s+{name}\s*\([^)]*\)\s*\{{", source)
    if not m:
        return None
    start = source.index("{", m.start())
    depth = 0
    for i in range(start, len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                return source[start + 1 : i]
    return None


def mutation_kind(body: str) -> str:
    for kind, rx in MUTATIONS:
        if rx.search(body):
            return kind
    return "unknown"


def victim_tokens(body: str):
    """Distinctive ids/classes/strings the mutation touches."""
    tokens = set()
    for sel in SELECTOR_ARG.findall(body):
        for tok in re.findall(r"[#.]([A-Za-z][\w-]{2,})", sel):
            if tok.lower() not in GENERIC:
                tokens.add(tok)
        for attr_val in re.findall(r"\[[\w-]+\s*[~^$*|]?=\s*[\"']?([^\"'\]]+)", sel):
            if len(attr_val) > 2:
                tokens.add(attr_val)
    # Corrupted values written in, and literals the mutation compares against.
    for rx in (ASSIGNED_STR, EQ_STR):
        for lit in rx.findall(body):
            lit = lit.strip()
            if len(lit) > 2 and lit.lower() not in GENERIC:
                tokens.add(lit)
    return sorted(tokens)


def expect_regions(text: str, window: int = 320):
    """Source slices starting at each expect( -- where assertion targets live."""
    return [text[m.start() : m.start() + window] for m in EXPECT_CALL.finditer(text)]


def suite_sources(app_dir: str):
    for sub in ("generation/frozen", "generation/workspace/tests"):
        d = os.path.join(app_dir, sub)
        if os.path.isdir(d):
            return "\n".join(
                open(p, errors="replace").read()
                for p in glob.glob(os.path.join(d, "*.spec.*"))
            )
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="results/wtp_headtohead")
    ap.add_argument("--out", default="results/wtp_headtohead/oracle_capability.csv")
    args = ap.parse_args()

    rows = []
    for baseline_dir, label in BASELINES.items():
        for app_dir in sorted(glob.glob(os.path.join(args.root, baseline_dir, "*"))):
            app = os.path.basename(app_dir)
            bug_csv = os.path.join(app_dir, "per_bug.csv")
            if not os.path.isfile(bug_csv):
                continue

            prepared = None
            for b in BASELINES:
                cand = os.path.join(args.root, b, app, "bugs", "_prepared")
                if os.path.isdir(cand):
                    prepared = cand
                    break

            suite = suite_sources(app_dir)
            regions = expect_regions(suite)
            has_count = bool(COUNT_ASSERT.search(suite))

            for rec in csv.DictReader(open(bug_csv)):
                bug, verdict = rec["bug_name"], rec["verdict"]
                path = os.path.join(prepared, f"{bug}.js") if prepared else ""
                body = (
                    body_of(open(path, errors="replace").read(), "onConditionMet")
                    if path and os.path.exists(path)
                    else None
                )
                kind = mutation_kind(body) if body else "unknown"
                tokens = victim_tokens(body) if body else []
                asserted = sorted(
                    {t for t in tokens if any(t in r for r in regions)}
                )

                if not body:
                    cap = "indeterminate"
                elif kind == "insert" and not asserted and not has_count:
                    cap = "needs_count_missing"
                elif asserted:
                    cap = "victim_mentioned"
                elif not tokens:
                    cap = "indeterminate"
                else:
                    cap = "victim_not_asserted"

                rows.append(
                    {
                        "baseline": label,
                        "app": app,
                        "bug_name": bug,
                        "verdict": verdict,
                        "mutation_kind": kind,
                        "capability": cap,
                        "victim_tokens": " | ".join(tokens[:6]),
                        "tokens_asserted": " | ".join(asserted[:4]),
                        "suite_has_count_assertion": has_count,
                    }
                )

    if not rows:
        sys.exit("no per_bug.csv found")

    with open(args.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(f"wrote {args.out} ({len(rows)} rows)\n")
    print("mutation kinds, all faults:")
    kinds = {}
    for r in rows:
        kinds[r["mutation_kind"]] = kinds.get(r["mutation_kind"], 0) + 1
    for k, v in sorted(kinds.items(), key=lambda x: -x[1]):
        print(f"   {k:10s} {v}")

    for scope, pred in (
        ("ARMED faults (oracle_miss + caught)", lambda r: r["verdict"] in ("oracle_miss", "caught")),
        ("faults that never armed", lambda r: r["verdict"] == "not_activated"),
    ):
        sub = [r for r in rows if pred(r)]
        if not sub:
            continue
        print(f"\ncapability -- {scope} (n={len(sub)}):")
        caps = {}
        for r in sub:
            caps[r["capability"]] = caps.get(r["capability"], 0) + 1
        for k, v in sorted(caps.items(), key=lambda x: -x[1]):
            print(f"   {k:22s} {v:3d}  ({v/len(sub):.0%})")


if __name__ == "__main__":
    main()
