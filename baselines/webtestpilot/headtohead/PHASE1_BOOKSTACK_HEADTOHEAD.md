# Phase 1 — BookStack head-to-head: two agent architectures, 27 injected faults each

Both baselines generated their suite autonomously from the clean application under container
isolation, froze it, and ran it against all 27 BookStack faults. Neither ever saw a fault.

## Result

| Metric | A — generic Claude Code Web UI prompt | B — Playwright Test Agents |
| --- | --- | --- |
| Spec files / tests | 11 / **69** | 36 / **36** |
| A. Clean stability | **100%** (69/69, 0 flaky) | **100%** (36/36, 0 flaky) |
| B. Bug activation | 15/27 — **55.6%** | 16/27 — **59.3%** |
| C. Conditional detection | **0/15 — 0%** | **0/16 — 0%** |
| D. **End-to-end detection** | **0/27 — 0%** | **0/27 — 0%** |
| E. Incidental failures | 0 | 0 |
| Environment errors | 0 | 0 |
| Generation | ~75 min, ~$6.50 | **~45 min, ~$2.90** |

Baseline A was additionally run under host isolation earlier and produced an **identical verdict
distribution** (15 oracle_miss / 12 not_activated / 0 caught) from a differently composed suite —
9 specs, no dashboard coverage, no coverage tracker. Three generations, 81 bug runs, zero catches.

## The mechanism, stated precisely

Not "the oracles were too weak". The sharper claim, and the one the data supports:

> **Generated tests verify the effect of their own action. WebTestPilot's faults are collateral
> damage to entities the test never names.**

The two baselines fail identically from opposite directions:

* **A**, dashboard: `expect(entityItems.first()).toBeVisible()` — "at least one item exists".
  A fault that injects a phantom book into the list leaves that assertion true.
* **B**, favourites: `expect(page.getByText('Book2')).toBeVisible()` — a genuinely stronger,
  entity-named assertion. But `favourite_book` removes the pre-seeded **`Shelf`** entry, not
  Book2. Also still true.

B's assertions are demonstrably better: derived from a written plan whose *Expected Result* fields
name concrete data ("the seeded books `Book`, `Book1`, `Book2` each appear as `.entity-list-item`
links"; "the deleted book's name no longer appears"). They still detect nothing here, because
positive membership on the entity under test cannot observe deletion of a sibling.

Detecting this fault class requires assertions neither architecture produces spontaneously:
count (`toHaveCount(n)`), full-list comparison, or explicit invariants over what must *not* change.

## Coverage and assertion aim are independent axes

Each architecture won one and lost the other:

| Surface | Faults | A | B |
| --- | --- | --- | --- |
| dashboard / recently-created | 9 | ✅ 8 tests (visibility-only) | ❌ never planned |
| recently-viewed | 5 | partial | ❌ |
| favourites | 5 | 1 usable test | ✅ 3 specs, entity-named assertions |
| comments | 1 | ❌ none | ✅ 2 specs |
| shelves / tags | — | ✅ | planned, not generated |

A prompt instruction did not close A's gap. The strengthened behavioural-postcondition
requirement ("assert the resulting data or state itself… do not rely solely on page-load,
element-visibility, URL, or navigation assertions") was in force for A's container run. The agent
wrote a coverage tracker claiming 52/52 and still produced eight visibility-only dashboard tests.
B's better assertions came from the planner's structured *Expected Result* field, not from
instruction — evidence that assertion quality here is an architectural property, not a prompting one.

## `not_activated` decomposes into three causes, all observed

| Cause | Instance | Whose limitation |
| --- | --- | --- |
| Coverage gap | A: no comment test exists | the tool's |
| Trigger-shape mismatch | `create_book`: fires only on a 2nd visit to `/books` in one browser context; Playwright isolates contexts per test | the benchmark's |
| **Data mismatch** | **B: wrote a correct comment test typing "This is a test comment"; the fault requires the literal "I like this template"** | **the benchmark's** |

The third had never been observable before, because no prior generation produced a comment test.
It matters for interpretation: **29 of 100** benchmark faults are trigger-literal-coupled (measured,
`benchmark_audit.csv`). On those, `not_activated` measures coupling between the benchmark's chosen
test data and the generator's — not test quality. B wrote a good comment test and scored the same
as A, which wrote none.

## The measuring instrument was validated

`0/27` is not an instrument failure. A deliberate 2-test control, aimed at what one fault actually
corrupts, returned **`caught`** on the same app through the same injector, fixture and classifier,
with the fault's own literal (`1 year ago`) in the failure text and `high` alignment confidence.

A 2-test suite caught what a 69-test suite missed. Detection is aim, not volume.

## Why the headline number should not stand alone

`0/27` conflates two independent failures. Decomposed:

* ~40% of faults never armed — coverage gaps plus trigger-shape and data-literal coupling, much of
  it benchmark-side rather than tool-side;
* 100% of faults that *did* arm were accepted, because assertions check the actor and the faults
  hit the neighbourhood.

Reporting D alone would attribute all of this to oracle weakness. B and C separate it.

## Provenance

Both suites: `isolation_mode: container`, `suite_provenance: claude-code-container`, `exit_code: 0`
(converged, not budget-terminated), workspace leakage audit clean. The benchmark tree was never
mounted into the agent's filesystem, so leakage is structurally impossible rather than audited.

Artifacts: `results/wtp_headtohead/{claude-code-baseline,playwright-agents}/` — `per_bug.csv`,
`per_test.csv`, `summary.json`, `summary.md`, `review_queue.md`, plus per-bug activation logs,
Playwright JSON reports and frozen suites. Baseline B additionally retains its planner output in
`generation/workspace/specs/{core-features,advanced-features}.md`.
