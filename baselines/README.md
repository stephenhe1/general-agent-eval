# Baseline arms: general agent harness (A) and Playwright test agents (B)

Two comparison baselines for the UI–Entity study, plus the trace-based scorer that measures how
much frozen ground truth each one's generated tests actually reach. Run 2026-09-01 over five
subjects: todomvc, keystone-blog, epic-stack, cypress-realworld-app, bangle-io.

## The arms

| Arm | What it is | Where its implementation lives |
|---|---|---|
| **A0** black-box | the general agent harness in its most naive mode: a sanitized workspace with app title/URL and nothing else | harness is external (`general-agent-eval`); orchestration is `arms/arms.sh` + `arms/scaffold.py` |
| **A1** repo-informed | same harness with repository access and the project's existing UI tests cleared (`--clear-tests`) | `arms/run-A1.sh`, `arms/stage-A1.sh` |
| **B** pw-agents | published Playwright test agents (`npx playwright init-agents --loop=claude`): planner → generator → healer | agents are generated into each workspace by `arms/arms.sh`; the three definitions land in `<workspace>/.claude/agents/` |

Arm A drives **this repository's own** harness through its console scripts
(`general-agent-eval-claude-code`, `general-agent-eval-clear-tests`). Arm B has no repository of
its own: `npx playwright init-agents --loop=claude` fetches the upstream Playwright agents, so the
only arm-B code is the launch and prompt block in `arms/arms.sh`. What this directory adds is the
orchestration of both arms, the reach scorer, and the run records.

## Layout

    arms/       drivers: workspace scaffolding, arm launch, tracing, per-subject reruns
    scoring/    trace-based reach scorer (reach2.py + events.py) and report generation
    records/    the run's inputs and results, including per-subject reach JSON and the prompts used

`scoring/reach2.py` imports `events` as a sibling module, so those two files must stay
co-located. `scoring/make_results.py` and `scoring/reach2.py` resolve `logs/` and `RESULTS.md`
relative to the **current working directory**, so run them from the workspace root, not from here.

## Generated tests and execution reports

    generated-tests/<subject>/<arm>/<original relative path>    281 specs
    execution-reports/<subject>/<arm>/results.json              15 reports

All 281 generated specs are committed with their original relative paths, verified by per-file
SHA-256 against the source workspaces: 281/281 copied, 0 missing, 0 corrupt. See
[MANIFEST.md](MANIFEST.md) for the per-subject/arm table.

### Correction to the arm B spec counts

An earlier count of arm B looked only at each workspace's `tests/` directory and reported
**1 / 8 / 49 / 10 / 38** (todomvc / keystone-blog / epic-stack / cypress-realworld-app / bangle-io).
That undercounted keystone-blog, whose specs live in `specs/` and `tests/rq6-agent/`.

Counting the entire workspace gives **1 / 23 / 98 / 21 / 84** — but that total includes copies the
generator's subagents left in `.claude/worktrees/agent-*/`, and 90 of those 106 copies are
byte-identical to a final spec. Both figures are therefore recorded, and they answer different
questions:

| | todomvc | keystone-blog | epic-stack | cypress-realworld-app | bangle-io | total |
|---|---:|---:|---:|---:|---:|---:|
| arm B, files present in the workspace | 1 | 23 | 98 | 21 | 84 | **227** |
| arm B, final specs (worktree copies excluded) | 1 | 23 | 49 | 10 | 38 | **121** |
| arm B, distinct file contents | 1 | 23 | 53 | 14 | 46 | **137** |

Arm A was unaffected: A0 is 1 / 5 / 7 / 8 / 5 = 26 and A1 is 1 / 9 / 6 / 6 / 6 = 28, with no
worktree copies. The **reach scores are unchanged** — `reach2.py` scores Playwright traces and
pass-filters through `results.json`, never by counting spec files, so a miscount of specs could not
and did not move them.

## What is deliberately not committed

The per-subject arm workspaces themselves stay out: 3.7 GB, almost entirely `node_modules`, browser
caches and trace archives. The Playwright traces are packaged separately (see *Trace archive*
below). The subjects are the UI–Entity study's evaluation targets, and the ground-truth inventories
the reach numbers are scored against live with that study, not here.

The workspace root defaults to `/Users/stephenhe/Projects/baseline-runs/20260901` and is
overridable:

    BASELINE_ROOT=/path/to/workspaces bash arms/run.sh

For continuity, that directory keeps symlinks back to every file moved here, so existing
invocations still work:

    cd $BASELINE_ROOT
    python3 reach2.py <subject> <subject>/<arm>/test-results   # e.g. todomvc todomvc/B-pwagents/test-results
    python3 make_results.py                                    # rebuilds RESULTS.md from logs/reach2-*.json

The second argument is the **trace directory**, not the arm directory: the scorer takes the arm
label from its parent and reads `<arm>/results.json` there to drop non-passing tests. Passing the
arm directory instead still produces a number, but with no pass-filtering and a mislabelled output
file — verified 2026-09-04, when doing exactly that wrote `reach2-todomvc-todomvc.json`.

## Trace archive

The Playwright traces the reach numbers were computed from are too large for the repository and are
distributed separately:

    baseline-traces-2026-09-04.tar.gz
    SHA-256  0467c47cce2498359d3b9c86dbd71f54832c68c21f983d5d0c7959804f6274c8
    689 MB (712,253,993 bytes), 924 trace.zip files

Verified on creation: `tar -tzf` lists cleanly with no errors, the archive holds exactly the 924
`trace.zip` files found in the workspaces (0 missing, 0 extra), and an extracted trace is
byte-identical to its source. Paths inside the archive are relative to the workspace root, so it
unpacks alongside a `20260901/` tree.

The archive pairs with baseline artifact commit `0f98705a3f4293d713ee6e51cb880e1757f328ae`
(`baselines: commit the 281 generated specs and 15 execution reports`), which is the state of
`generated-tests/`, `execution-reports/` and `MANIFEST.md` the traces correspond to. Not included in
the archive: 57 PNG screenshots that sit beside the traces in `test-results/`.

## How reach is measured

`reach2.py` reads ordered event streams from Playwright traces and asks, for each GT item,
whether a **passing** test drove that item's workflow **through its commit**:

- a mutation counts as accepted only when the HTTP status is < 400 **and** the response carries no
  GraphQL `errors` — GraphQL failures return 200, so status alone is not enough;
- the accepted mutation must follow the driving action, so an unrelated earlier write cannot score;
- request and response bodies are resolved through their sha1 resource entries, without which
  GraphQL payloads are invisible;
- action matching is against the **selector only**. Matching values instead produced a false
  positive (the needle `alt` matched the value `OriginalTitle-…`), which cost epic-stack A1 one
  point: 5/8 → 4/8.

Reach is an **upper bound on coverage**: it does not ask whether the test asserted the item's
postcondition.

## Known staleness in the records

- `records/RESULTS.md` uses **11** in-scope items for cypress-realworld-app. That inventory was
  corrected to **10** on 2026-09-03 (`POST /logout` has no persistent effect: its handler only
  clears the cookie and destroys an in-process MemoryStore session). The RWA row is therefore
  scored against the superseded denominator.
- Its `technique (predictions)` column is quoted from the technique's own record and counts
  *predicted* functionalities, not executed tests. The two columns are not the same measurement
  and should not be read as a head-to-head.
- A DOM-witness result for arm B was retracted: Playwright re-serializes only changed subtrees, so
  per-snapshot `todo-item` counts are not list lengths. `scoring/dom_witness.py` is kept for
  provenance; do not treat its output as a list-length oracle.
