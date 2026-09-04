#!/usr/bin/env python3
"""Did the app's own DOM change? A state witness for client-side subjects.

Playwright records a DOM snapshot around each call. Counting the app's list items across
those snapshots shows whether a workflow actually took effect, independently of what the
test clicked and independently of what it asserted.
"""
import json, re, zipfile
from pathlib import Path

def snapshots(zip_path: Path):
    """(wallTime, serialized html) per frame snapshot, in order."""
    out = []
    with zipfile.ZipFile(zip_path) as zf:
        for n in zf.namelist():
            if not n.endswith(".trace"):
                continue
            for line in zf.read(n).decode("utf-8", "replace").splitlines():
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get("type") != "frame-snapshot":
                    continue
                snap = d.get("snapshot") or {}
                if not snap.get("isMainFrame"):
                    continue
                out.append((float(snap.get("wallTime") or 0.0), json.dumps(snap.get("html"))))
    out.sort(key=lambda x: x[0])
    return out


def todo_state(html: str):
    """(number of todo items, number marked completed) in one snapshot, or None if the list
    subtree was not materialised in this snapshot (Playwright reuses unchanged subtrees)."""
    if "todo-item" not in html:
        return None
    items = len(re.findall(r'"data-cy",\s*"todo-item"', html)) or \
            len(re.findall(r'todo-item"', html))
    completed = len(re.findall(r'"class",\s*"[^"]*completed', html))
    return items, completed
