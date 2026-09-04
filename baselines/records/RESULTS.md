# Baseline reach against ground truth

Generated 2026-09-04T14:45:17+00:00 by `make_results.py` from `logs/reach2-*.json`; regenerate rather than edit.

**Reach** = a *passing* test drove the GT item's workflow **through its commit**. It is an
upper bound on coverage: it does not ask whether the test asserted the item's postcondition.

| subject | GT items | A1 repo-informed | A0 black-box | B pw-agents | technique (predictions) |
|---|---|---|---|---|---|
| todomvc | 6 | **6/6** | **6/6** | **6/6** | 5/6 |
| keystone-blog | 10 | **7/10** | **7/10** | **9/10** | 10/10 |
| epic-stack | 8 | **4/8** | **4/8** | **3/8** | 8/8 |
| bangle-io | 14 | **7/14** | **12/14** | **8/14** | 8/14 |
| cypress-realworld-app | 11 | **10/11** | **9/11** | **7/11** | 8/11 |

The technique's column counts *predicted* functionalities from its catalog, not executed
tests, and is quoted from its own record. The two columns are not the same measurement.

Generated-test counts per arm (see `../MANIFEST.md`; these do not enter the reach computation,
which scores traces and pass-filters through `results.json`):

| arm | todomvc | keystone-blog | epic-stack | cypress-realworld-app | bangle-io |
|---|---:|---:|---:|---:|---:|
| A0 black-box | 1 | 5 | 7 | 8 | 5 |
| A1 repo-informed | 1 | 9 | 6 | 6 | 6 |
| B pw-agents, final | 1 | 23 | 49 | 10 | 38 |
| B pw-agents, files incl. `.claude/worktrees/` copies | 1 | 23 | 98 | 21 | 84 |

## bangle-io

| GT item | A1 | A0 | B |
|---|---|---|---|
| B01 create workspace | yes (34) | yes (59) | yes (27) |
| B02 delete workspace | **no** | yes (1) | **no** |
| B03 create note | yes (27) | yes (35) | yes (22) |
| B04 edit note content | yes (2) | **no** | **no** |
| B05 rename note | **no** | yes (2) | yes (1) |
| B06 move note | **no** | **no** | **no** |
| B07 clone note | **no** | yes (1) | yes (1) |
| B08 delete note | yes (1) | yes (2) | yes (1) |
| B09 create directory | **no** | yes (2) | yes (1) |
| B10 daily note | **no** | yes (2) | yes (1) |
| B11 star / unstar | yes (2) | yes (3) | **no** |
| B12 toggle wide editor | yes (1) | yes (1) | **no** |
| B13 toggle sidebar | yes (1) | yes (1) | yes (1) |
| B14 switch theme | **no** | yes (2) | **no** |

- A1: harness naive mode, repo-informed (existing UI tests cleared): 50 passing tests considered; commit witness = committing action, ordered, negative paths excluded.

- A0: harness naive mode, black-box (live app only, no repo): 68 passing tests considered; commit witness = committing action, ordered, negative paths excluded.

- B: Playwright test agents: 29 passing tests considered; commit witness = committing action, ordered, negative paths excluded.

## cypress-realworld-app

| GT item | A1 | A0 | B |
|---|---|---|---|
| R01 create a transaction | yes (3) | yes (4) | yes (4) |
| R02 update a transaction | **no** | **no** | **no** |
| R03 comment on a transaction | yes (1) | yes (1) | **no** |
| R04 like a transaction | yes (1) | yes (1) | **no** |
| R05 create a bank account | yes (2) | yes (3) | yes (3) |
| R06 delete a bank account | yes (1) | yes (1) | yes (1) |
| R07 sign up a user | yes (1) | yes (3) | yes (5) |
| R08 update my profile | yes (1) | yes (1) | yes (1) |
| R09 dismiss a notification | yes (2) | **no** | yes (1) |
| R10 log in | yes (29) | yes (31) | yes (37) |
| R11 log out | yes (1) | yes (1) | **no** |

- A1: harness naive mode, repo-informed (existing UI tests cleared): 36 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

- A0: harness naive mode, black-box (live app only, no repo): 35 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

- B: Playwright test agents: 46 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

## epic-stack

| GT item | A1 | A0 | B |
|---|---|---|---|
| ES-01 create a note | yes (3) | yes (4) | yes (6) |
| ES-02 edit a note | yes (1) | yes (1) | yes (2) |
| ES-03 delete a note | yes (1) | yes (1) | yes (2) |
| ES-04 add an image | **no** | **no** | **no** |
| ES-05 change alt text | **no** | **no** | **no** |
| ES-06 remove an image | **no** | **no** | **no** |
| ES-07 update profile | yes (1) | yes (1) | **no** |
| ES-10 change password | **no** | **no** | **no** |

- A1: harness naive mode, repo-informed (existing UI tests cleared): 74 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

- A0: harness naive mode, black-box (live app only, no repo): 59 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

- B: Playwright test agents: 51 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

## keystone-blog

| GT item | A1 | A0 | B |
|---|---|---|---|
| KS-01 create an Author | yes (6) | yes (1) | yes (6) |
| KS-02 edit an Author | yes (1) | yes (1) | yes (1) |
| KS-03 verify/unverify | **no** | **no** | **no** |
| KS-04 delete an Author | yes (1) | yes (2) | yes (6) |
| KS-05 create a Post | yes (7) | yes (2) | yes (9) |
| KS-06 edit a Post | yes (1) | yes (1) | yes (2) |
| KS-07 publish/unpublish | yes (2) | yes (1) | yes (1) |
| KS-09 assign an Author | **no** | **no** | yes (4) |
| KS-10 set a Post's Tags | **no** | **no** | yes (1) |
| KS-12 delete a Post | yes (1) | yes (1) | yes (9) |

- A1: harness naive mode, repo-informed (existing UI tests cleared): 70 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

- A0: harness naive mode, black-box (live app only, no repo): 46 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

- B: Playwright test agents: 43 passing tests considered; commit witness = accepted mutation, ordered after the driving action.

## todomvc

| GT item | A1 | A0 | B |
|---|---|---|---|
| T1 create a todo | yes (33) | yes (34) | yes (32) |
| T2 edit a todo's text | yes (2) | yes (3) | yes (1) |
| T3 toggle one todo | yes (13) | yes (16) | yes (12) |
| T4 delete a todo | yes (3) | yes (3) | yes (2) |
| T5 toggle all todos | yes (2) | yes (2) | yes (3) |
| T6 clear completed | yes (2) | yes (2) | yes (1) |

- A1: harness naive mode, repo-informed (existing UI tests cleared): 38 passing tests considered; commit witness = committing action, ordered, negative paths excluded.

- A0: harness naive mode, black-box (live app only, no repo): 43 passing tests considered; commit witness = committing action, ordered, negative paths excluded.

- B: Playwright test agents: 36 passing tests considered; commit witness = committing action, ordered, negative paths excluded.

## Adjudication notes

- **keystone KS-09 (A)**: its test *"create post with author relation saves the relation"* types
  into the author combobox, never clicks the option, and the `createPost` payload carries only
  `title`. The relation was never saved and the test still passes: not reached.
- **keystone KS-10 (A)**: the only tag-related test sets the relation from the *Tag* side
  (`createTag` with a posts connection). The join rows move, but the GT workflow is
  `/posts/<id> -> tags -> Save`. Recorded as not reached; direction is an open call.
- **epic ES-10**: the suite's only password submission answers HTTP 400 (it is the negative
  test). Attempted, refused, not counted.
- **todomvc T2**: Escape discards an edit, so an Escape-terminated edit does not count; a
  blur (click outside the edit box) does.

## Provenance

- Arm A: `general-agent-eval-claude-code --workload javascript --mode baseline`, sonnet-4-6.
- Arm B: `npx playwright init-agents --loop=claude`, driven by the same driver prompt the
  published playwright-agents arm uses; only the generated suite is scored (the planner's
  `specs/explore*` scratch and `.claude/worktrees/**` copies are excluded).
- Both arms get an identical sanitized workspace: same `package.json`, same config
  (1280x720, serial, no retries), same `APP_NOTES.md`.
- Keystone: each arm traced from `keystone-example.pristine.db`, restored between arms.

- **keystone-blog A1 pending**: still generating at the time of writing
- **epic-stack pending**: arm B generating (attempt 3); arm A must be re-scored from a pristine DB with the ordered scorer
- **bangle-io pending**: arm B generating; neither arm traced yet
- **cypress-realworld-app pending**: both arms generated; rules not written, will match REST paths
