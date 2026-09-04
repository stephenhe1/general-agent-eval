#!/usr/bin/env python3
"""Proof for TodoMVC: for each GT item, a test whose DOM state actually changed.

Evidence is the app's own re-serialised DOM in the trace, never the test's assertions.
A subtree that changes is always materialised in its snapshot, so a changed todo list is
readable even though unchanged subtrees are stored as back-references.
"""
import re, sys
from pathlib import Path
from dom_witness import snapshots
from events import events_per_test

ITEM = re.compile(r'"data-testid":\s*"todo-item"')
COMPLETED_LI = re.compile(r'\["LI",\s*\{"class":\s*"[^"]*completed')
LABEL_TEXT = re.compile(r'"data-testid":\s*"todo-body-text"\},\s*"([^"]*)"')

def states(zip_path):
    """Materialised list states over time: (t, items, completed, labels)."""
    out = []
    for t, html in snapshots(zip_path):
        if "todo-list" not in html and "todo-item" not in html:
            out.append((t, None, None, None))          # list not materialised in this snapshot
            continue
        out.append((t, len(ITEM.findall(html)), len(COMPLETED_LI.findall(html)),
                    LABEL_TEXT.findall(html)))
    return out

def materialised(st):
    return [(t, i, c, l) for t, i, c, l in st if i is not None]

def prove(arm_dir: Path, label: str):
    ev = events_per_test(arm_dir / "test-results")
    print(f"\n########## {label}")
    findings = {}
    for zp in sorted((arm_dir / "test-results").rglob("trace.zip")):
        name = zp.parent.name
        st = materialised(states(zp))
        if not st:
            continue
        items = [i for _, i, _, _ in st]
        comps = [c for _, _, c, _ in st]
        labels = [l for _, _, _, l in st]
        acts = [e for e in ev.get(name, []) if e["kind"] == "action"]
        def did(method, needle):
            return any(e["method"] in (method if isinstance(method, tuple) else (method,))
                       and needle in e["selector"] for e in acts)
        # T1 create: list grew
        if max(items) > items[0] and did("press", "new-todo"):
            findings.setdefault("T1 create a todo", (name, f"items {items[0]} -> {max(items)}"))
        # T4 delete: list shrank after a destroy click
        if did("click", "delete-todo-btn") and min(items[1:] or items) < max(items):
            findings.setdefault("T4 delete a todo", (name, f"items {max(items)} -> {min(items)}"))
        # T3 toggle one: a single item became completed
        if did(("check", "click"), "todo-item-complete-check") and max(comps) > comps[0]:
            findings.setdefault("T3 toggle one todo", (name, f"completed {comps[0]} -> {max(comps)}"))
        # T5 toggle all: every item completed after driving toggle-all
        if did(("check", "click"), "toggle-all") and max(comps) >= 2 and max(comps) == max(items):
            findings.setdefault("T5 toggle all todos", (name, f"completed {comps[0]} -> {max(comps)} of {max(items)}"))
        # T6 clear completed: completed items vanished
        if did("click", "clear-completed") and max(comps) > 0 and comps[-1] == 0 and items[-1] < max(items):
            findings.setdefault("T6 clear completed", (name, f"items {max(items)} -> {items[-1]}, completed {max(comps)} -> 0"))
        # T2 edit: a label's text changed
        flat = [x for l in labels for x in l]
        if did("dblclick", "todo-body-text") and len(set(flat)) > 1:
            before, after = flat[0], flat[-1]
            if before != after:
                findings.setdefault("T2 edit a todo's text", (name, f"label {before!r} -> {after!r}"))
    for key in ("T1 create a todo", "T2 edit a todo's text", "T3 toggle one todo",
                "T4 delete a todo", "T5 toggle all todos", "T6 clear completed"):
        if key in findings:
            test, delta = findings[key]
            print(f"  PROVEN  {key:24} {delta}")
            print(f"          witness test: {test[-58:]}")
        else:
            print(f"  ------  {key:24} no DOM state change found")
    print(f"  proven by DOM state: {len(findings)}/6")

for arm, label in (("A-naive", "TodoMVC arm A (naive harness)"),
                   ("B-pwagents", "TodoMVC arm B (Playwright agents)")):
    prove(Path("todomvc") / arm, label)
