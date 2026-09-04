#!/usr/bin/env python3
"""Regenerate RESULTS.md from the scorer's own JSON rows. Nothing here is retyped by hand."""
import json, glob
from pathlib import Path
from datetime import datetime, timezone

# The technique's own numbers, quoted from its record, NOT recomputed here. Different artifact
# type: predictions from a catalog, not executed tests -- kept in its own column and labelled.
TECHNIQUE = {
    "todomvc": ("5/6", "misses T5 toggle-all (MANUAL_VERIFICATION.md, TodoMVC inventory)"),
    "keystone-blog": ("10/10", "predicted CORE, hand-adjudicated"),
    "epic-stack": ("8/8", "predicted CORE; 2 of 8 oracle-confirmed"),
    "bangle-io": ("8/14", "MANUAL_VERIFICATION.md, bangle-io inventory"),
    "cypress-realworld-app": ("8/11", "MANUAL_VERIFICATION.md, RWA inventory"),
}
ARMS = {"A1-repo": "A1: harness naive mode, repo-informed (existing UI tests cleared)",
        "A-naive": "A0: harness naive mode, black-box (live app only, no repo)",
        "B-pwagents": "B: Playwright test agents"}
ARM_ORDER = ["A1-repo", "A-naive", "B-pwagents"]
PENDING = {
    "keystone-blog A1": "still generating at the time of writing",
    "epic-stack": "arm B generating (attempt 3); arm A must be re-scored from a pristine DB with the ordered scorer",
    "bangle-io": "arm B generating; neither arm traced yet",
    "cypress-realworld-app": "both arms generated; rules not written, will match REST paths",
}

rows = {}
for f in sorted(glob.glob("logs/reach2-*.json")):
    d = json.loads(Path(f).read_text())
    rows.setdefault(d["subject"], {})[d["arm"]] = d

lines = [
    "# Baseline reach against ground truth",
    "",
    f"Generated {datetime.now(timezone.utc).isoformat(timespec='seconds')} by `make_results.py` "
    "from `logs/reach2-*.json`; regenerate rather than edit.",
    "",
    "**Reach** = a *passing* test drove the GT item's workflow **through its commit**. It is an",
    "upper bound on coverage: it does not ask whether the test asserted the item's postcondition.",
    "",
    "| subject | GT items | A1 repo-informed | A0 black-box | B pw-agents | technique (predictions) |",
    "|---|---|---|---|---|---|",
]
for subject in ("todomvc", "keystone-blog", "epic-stack", "bangle-io", "cypress-realworld-app"):
    got = rows.get(subject, {})
    def cell(arm):
        d = got.get(arm)
        return f"**{d['reach']}/{d['items']}**" if d else "_pending_"
    items = next((str(d["items"]) for d in got.values()), "-")
    tech, _ = TECHNIQUE[subject]
    lines.append(f"| {subject} | {items} | {cell('A1-repo')} | {cell('A-naive')} | {cell('B-pwagents')} | {tech} |")

lines += ["", "The technique's column counts *predicted* functionalities from its catalog, not executed",
          "tests, and is quoted from its own record. The two columns are not the same measurement.", ""]

for subject, got in rows.items():
    lines += [f"## {subject}", ""]
    names = sorted({k for d in got.values() for k in d["per_item"]})
    order = [a for a in ARM_ORDER if a in got]
    lines += ["| GT item | " + " | ".join(ARMS[a].split(":")[0] for a in order) + " |",
              "|---|" + "---|" * len(order)]
    for name in names:
        cells = []
        for arm in order:
            n = got[arm]["per_item"].get(name, 0)
            cells.append(f"yes ({n})" if n else "**no**")
        lines.append(f"| {name} | " + " | ".join(cells) + " |")
    for arm in order:
        d = got[arm]
        lines += ["", f"- {ARMS[arm]}: {d['tests_considered']} passing tests considered; "
                      f"commit witness = {d['witness']}."]
    lines.append("")

lines += ["## Adjudication notes", "",
          "- **keystone KS-09 (A)**: its test *\"create post with author relation saves the relation\"* types",
          "  into the author combobox, never clicks the option, and the `createPost` payload carries only",
          "  `title`. The relation was never saved and the test still passes: not reached.",
          "- **keystone KS-10 (A)**: the only tag-related test sets the relation from the *Tag* side",
          "  (`createTag` with a posts connection). The join rows move, but the GT workflow is",
          "  `/posts/<id> -> tags -> Save`. Recorded as not reached; direction is an open call.",
          "- **epic ES-10**: the suite's only password submission answers HTTP 400 (it is the negative",
          "  test). Attempted, refused, not counted.",
          "- **todomvc T2**: Escape discards an edit, so an Escape-terminated edit does not count; a",
          "  blur (click outside the edit box) does.", "",
          "## Provenance", "",
          "- Arm A: `general-agent-eval-claude-code --workload javascript --mode baseline`, sonnet-4-6.",
          "- Arm B: `npx playwright init-agents --loop=claude`, driven by the same driver prompt the",
          "  published playwright-agents arm uses; only the generated suite is scored (the planner's",
          "  `specs/explore*` scratch and `.claude/worktrees/**` copies are excluded).",
          "- Both arms get an identical sanitized workspace: same `package.json`, same config",
          "  (1280x720, serial, no retries), same `APP_NOTES.md`.",
          "- Keystone: each arm traced from `keystone-example.pristine.db`, restored between arms.", ""]
for subject, note in PENDING.items():
    lines.append(f"- **{subject} pending**: {note}")
Path("RESULTS.md").write_text("\n".join(lines) + "\n")
print("\n".join(lines[:22]))
