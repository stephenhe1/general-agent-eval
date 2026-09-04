# Baseline artifact manifest

Generated specs and Playwright execution reports for the 2026-09-01 baseline run,
copied out of the arm workspaces with per-file SHA-256 verification: 281/281 specs
copied, 0 missing, 0 corrupt, 15/15 `results.json` present.

`Generated specs` counts every `*.spec.ts` under the arm workspace excluding
`node_modules/` and the scaffold-written `seed.spec.ts`. Arm B's total splits into the
**final** specs and the **copies left in `.claude/worktrees/agent-*/`** by the
generator's subagents; the two are kept separate because the worktree copies are
largely byte-identical re-materialisations, not additional tests.

| Subject | Arm | Generated specs | final | worktree copies | distinct contents | results.json | Source workspace |
|---|---|---:|---:|---:|---:|:--:|---|
| todomvc | A-naive | **1** | 1 | 0 | 1 | yes | `20260901/todomvc/A-naive` |
| todomvc | A1-repo | **1** | 1 | 0 | 1 | yes | `20260901/todomvc/A1-repo` |
| todomvc | B-pwagents | **1** | 1 | 0 | 1 | yes | `20260901/todomvc/B-pwagents` |
| keystone-blog | A-naive | **5** | 5 | 0 | 5 | yes | `20260901/keystone-blog/A-naive` |
| keystone-blog | A1-repo | **9** | 9 | 0 | 9 | yes | `20260901/keystone-blog/A1-repo` |
| keystone-blog | B-pwagents | **23** | 23 | 0 | 23 | yes | `20260901/keystone-blog/B-pwagents` |
| epic-stack | A-naive | **7** | 7 | 0 | 7 | yes | `20260901/epic-stack/A-naive` |
| epic-stack | A1-repo | **6** | 6 | 0 | 6 | yes | `20260901/epic-stack/A1-repo` |
| epic-stack | B-pwagents | **98** | 49 | 49 | 53 | yes | `20260901/epic-stack/B-pwagents` |
| cypress-realworld-app | A-naive | **8** | 8 | 0 | 8 | yes | `20260901/cypress-realworld-app/A-naive` |
| cypress-realworld-app | A1-repo | **6** | 6 | 0 | 6 | yes | `20260901/cypress-realworld-app/A1-repo` |
| cypress-realworld-app | B-pwagents | **21** | 10 | 11 | 14 | yes | `20260901/cypress-realworld-app/B-pwagents` |
| bangle-io | A-naive | **5** | 5 | 0 | 5 | yes | `20260901/bangle-io/A-naive` |
| bangle-io | A1-repo | **6** | 6 | 0 | 6 | yes | `20260901/bangle-io/A1-repo` |
| bangle-io | B-pwagents | **84** | 38 | 46 | 46 | yes | `20260901/bangle-io/B-pwagents` |
| **total** | | **281** | 175 | 106 | | 15/15 | |

## Layout

    generated-tests/<subject>/<arm>/<original relative path>
    execution-reports/<subject>/<arm>/results.json

Each spec keeps the path it had inside its arm workspace, so arm A's `rq6-agent/`,
epic-stack A1's `tests/e2e/rq6-agent/`, keystone-blog B's `specs/` and `tests/rq6-agent/`,
and arm B's `.claude/worktrees/agent-*/tests/` all remain distinguishable.

`execution-reports/*/results.json` is the Playwright JSON report the reach scorer reads
to drop non-passing tests (`reach2.py` loads it from the arm directory). It is included so
the pass-filtering step can be re-checked without the workspaces.

## A note on `.claude/worktrees/` paths

The repository's root `.gitignore:228` ignores `.claude/`, which would have silently dropped the
106 worktree copies while the other 175 specs committed cleanly. They were added with `git add -f`
so the count in this manifest matches the workspaces exactly. If these files are ever re-added
after deletion, the same `-f` is required.

## Verification performed

- 281 source specs found by scanning each **entire** arm workspace (excluding `node_modules/` and
  the scaffold-written `seed.spec.ts`); 281 copied; 281 tracked by git.
- Every destination path equals `generated-tests/<subject>/<arm>/<original relative path>`; set
  difference against the source listing is empty in both directions.
- Per-file SHA-256 compared source against destination: 0 mismatches.
- 120 filenames repeat across arms and worktrees; the full paths are distinct, so no spec is
  overwritten or deduplicated.
- 15/15 `results.json` execution reports present.
