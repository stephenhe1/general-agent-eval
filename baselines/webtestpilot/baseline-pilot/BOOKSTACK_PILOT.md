# BookStack 3-bug pilot — results

Real BookStack (Podman, `CONTAINER_CLI=podman`), suite generated autonomously by
the existing Claude Code harness (`--workload javascript --mode baseline
--coverage-model flat`), frozen before any bug was seen.

## Provenance

| | |
| --- | --- |
| Target | BookStack 25.02.1, `localhost:8081`, seeded via `webapps/start_app.sh` |
| Runtime | Podman 6.1.0, applehv VM, rootless/crun; app container emulated amd64 |
| Generation | ~55 min, exit 0 (converged, not budget-terminated), `$12` cap unreached |
| Frozen suite | 9 spec files + `helpers.ts`, **69 tests**, sha256-verified before each arm |
| Anti-leakage | workspace audit **clean** (14 files); transcript audit **clean, 0 findings** |
| Bugs | `comment`, `create_book`, `recent_activity_all` (3 distinct trigger styles) |

## Metrics

| Metric | Value |
| --- | --- |
| A. Clean stability rate | **98.6%** (68/69 stable, 1 failing, **0 flaky**) |
| B. Bug activation rate | **33.3%** (1/3) |
| C. Conditional fault detection rate | **0%** (0/1 activated) |
| D. **End-to-end fault detection rate** | **0%** (0/3) |
| E. Incidental failure rate | 0% |

Verdicts: `caught` 0 · `oracle_miss` 1 · `not_activated` 2 · `incidental_failure` 0 · `environment_error` 0

## Per bug — and why each missed

Three bugs, three *different* failure modes, only one of which is an oracle weakness.

### `comment` → `not_activated` (coverage gap)

The suite contains **zero references to commenting** — 0 occurrences of "comment"
across all 10 frozen files. Armed in 0/69 tests. `pages.spec.ts` covers view,
revisions, create, move, permissions, delete, export, markdown export, and copy,
but never the comment section that sits below every page body.

Not a data mismatch. The agent never discovered the feature.

### `create_book` → `not_activated` (trigger-shape mismatch)

The fault fires only on the **second** entry to `/books` in one browser context,
counted in `sessionStorage`. Measured navigation per test:

```
1x /books   books listing shows all books
1x /books   create book - new book appears in listing   (/create-book -> /books)
0x /books   view / edit / delete / export / permissions / sort ...
```

No test enters `/books` twice, and Playwright gives every test a fresh context, so
the counter resets and never reaches 2. Armed in 0/69.

### `recent_activity_all` → `oracle_miss` (genuine oracle weakness)

Armed in exactly **1/69** tests — `my-account.spec.ts > public user profile page
loads`, which renders a `#recent-user-activity` section and so satisfies the
DOM-presence trigger. The fault rewrote an activity timestamp to "1 year ago";
that test only asserts the page loads.

No test anywhere asserts recency: grepping the frozen suite for `ago`,
`activity-list`, `recent activity`, or `timestamp` returns **zero** matches. The
suite exercised the corrupted view and accepted it.

## The methodological finding

WebTestPilot's bugs were authored against **WebTestPilot's own agent**, which walks
one long scripted session through a fixed step list, so triggers may rely on
accumulated in-session state and on specific literals. An independently generated
Playwright suite has per-test context isolation and a different navigation profile,
so a meaningful fraction of the benchmark's triggers never fire at all.

Consequence: **`caught / 100` is not a valid mutation score for suite-level
evaluation.** Reported alone it understates any technique — including the one under
development — by conflating "oracle too weak" with "fault never armed". Metric B
(activation) and metric C (conditional detection) must be reported alongside D.

This pilot is empirical support for that separation: of 3 faults, 2 never armed for
reasons unrelated to oracle quality, so the informative number is C = 0/1, not D = 0/3.

`not_activated` needs three sub-causes, not one:

1. **coverage gap** — feature never exercised (`comment`)
2. **trigger-shape mismatch** — required navigation/state pattern never produced (`create_book`)
3. **data mismatch** — feature exercised with different literals (seen on the self-test app)

## Clean-stability detail

The single clean-failing test is
`favourites.spec.ts::toggling favourite on a book adds it to favourites list`,
failing deterministically in all 3 repetitions (`[1, 1, 1]`), not flaky. BookStack's
`seed.sql` inserts 4 `favourites` rows, so a test assuming an un-favourited start
would toggle *off* rather than on. It was correctly excluded from detecting any
fault in all three bug runs (recorded in each verdict's `notes`).

## Cost

| Phase | Wall clock |
| --- | --- |
| Generation (one-time per app) | ~55 min |
| Evaluate: 5 measured cycles | 21.2 min |
| **Mean per cycle** (reset + reseed + 69 tests) | **4.2 min** |

Projected full benchmark, serial, on this machine: 4 generations (~3.7 h) + 112
cycles x 4.2 min (~7.8 h) = **~11.5 h**. Sharding by application across 4 workers
(distinct ports and compose projects) cuts wall clock to roughly **3 h**. Native
x86_64 would cut the per-cycle time further; the app container is emulated here.

## Caveats

- **Arch deviation**: `mysql:8.4` has no platform pin so it runs native arm64 while
  the app container runs emulated amd64. Same versions and seed; compose files
  unmodified.
- **Seed is date-parameterized**: BookStack's seed substitutes yesterday's date into
  81 placeholders, so timestamps shift daily. Stable within a run; not reproducible
  byte-for-byte months later.
- **`UI_COVERAGE.md` was never created** despite both prompts instructing the agent
  to maintain it. Not load-bearing in `baseline` mode, but it would be in the
  graph/feature pipelines, where the tracker *is* the test plan.
- **3 bugs, not 27.** This is a pilot. No claim is made about BookStack's full bug
  set, and the full benchmark was not launched.
