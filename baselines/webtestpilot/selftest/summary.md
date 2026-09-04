# WebTestPilot injected-bug evaluation — HARNESS VALIDATION (not a baseline result)

> **These numbers do not measure the Claude Code baseline.** They exist to
> validate the evaluation harness, because the target is the evaluator's self-test application, not a benchmark application; and the suite was not produced by an agent run (provenance: reused-workspace).
> Do not cite them as baseline fault-detection results.

## Provenance

- **generated_at**: 20260818T182513Z
- **target_app**: selftest
- **bug_source_app**: bookstack
- **is_selftest_target**: True
- **model**: sonnet
- **clean_repetitions**: 3
- **bugs_evaluated**: 4
- **viewport**: 1280x720
- **run_dir**: /tmp/scale/wtp-pilot-run
- **wtp_root**: /Users/stephenhe/Projects/WebTestPilot/WebTestPilot
- **isolation**: host
- **suite_provenance**: reused-workspace
- **frozen_suite_verified**: True

## Headline

**End-to-end suite fault detection rate: 50.0%** (2/4 benchmark faults exposed)

| Metric | Value |
| --- | --- |
| A. Clean stability rate | 85.7% (6/7 tests) |
| B. Bug activation rate | 75.0% (3/4) |
| C. Conditional fault detection rate | 66.7% (2/3) |
| D. End-to-end fault detection rate (primary) | 50.0% |
| E. Incidental failure rate | 0.0% |

### Verdict counts

| Verdict | Count |
| --- | --- |
| caught | 2 |
| oracle_miss | 1 |
| not_activated | 1 |
| incidental_failure | 0 |
| environment_error | 0 |

0 verdict(s) flagged for manual behaviour-alignment review — see `review_queue.md`.

## Per application

| App | Tests | Clean stable | Bugs | Activated | Caught | Oracle miss | Not activated | Incidental | Env error | E2E detection |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| selftest | 7 | 6 | 4 | 3 | 2 | 1 | 1 | 0 | 0 | 50.0% |

## Per bug

| App | Bug | Activated | Verdict | Confidence | Detecting test | Review? |
| --- | --- | --- | --- | --- | --- | --- |
| selftest | `comment` | no | **not_activated** | — | — | no |
| selftest | `create_book` | yes | **caught** | high | book grid keeps its descriptions across repeat visits | no |
| selftest | `recent_activity_all` | yes | **caught** | high | activity feed shows the recorded time for each book activity | no |
| selftest | `search` | yes | **oracle_miss** | — | — | no |

## Reading these numbers

- `not_activated` means the generated suite never drove the application into the
  state the fault keys on, so the fault never fired. It is not an oracle failure,
  but it still counts against the primary end-to-end metric: the suite did not
  expose that benchmark fault.
- `caught` requires an activated fault plus a *clean-stable* test failing on a
  failed assertion. Timeouts and runtime errors are `incidental_failure`.
- Verdicts are automatic. Any row with `Review? = yes` needs human confirmation
  that the failing assertion detects the same behavioural property the fault
  violated. Evidence for every failure is preserved under each bug's run dir.

