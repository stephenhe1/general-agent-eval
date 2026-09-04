# WebTestPilot injected-bug evaluation — Claude Code Web UI baseline

Autonomously generated Playwright suites, frozen before any bug was seen,
run against WebTestPilot's injected faults.

## Provenance

- **generated_at**: 20260819T171838Z
- **target_app**: bookstack
- **bug_source_app**: bookstack
- **is_selftest_target**: False
- **model**: sonnet
- **clean_repetitions**: 3
- **bugs_evaluated**: 27
- **viewport**: 1280x720
- **container_cli**: podman
- **run_dir**: /Users/stephenhe/Projects/general-agent-eval/results/webtestpilot_baseline/bookstack
- **wtp_root**: /Users/stephenhe/Projects/WebTestPilot/WebTestPilot
- **isolation**: host
- **suite_provenance**: claude-code-host
- **frozen_suite_verified**: True

## Headline

**End-to-end suite fault detection rate: 0.0%** (0/27 benchmark faults exposed)

| Metric | Value |
| --- | --- |
| A. Clean stability rate | 98.6% (68/69 tests) |
| B. Bug activation rate | 55.6% (15/27) |
| C. Conditional fault detection rate | 0.0% (0/15) |
| D. End-to-end fault detection rate (primary) | 0.0% |
| E. Incidental failure rate | 0.0% |

### Verdict counts

| Verdict | Count |
| --- | --- |
| caught | 0 |
| oracle_miss | 15 |
| not_activated | 12 |
| incidental_failure | 0 |
| environment_error | 0 |

0 verdict(s) flagged for manual behaviour-alignment review — see `review_queue.md`.

## Per application

| App | Tests | Clean stable | Bugs | Activated | Caught | Oracle miss | Not activated | Incidental | Env error | E2E detection |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bookstack | 69 | 68 | 27 | 15 | 0 | 15 | 12 | 0 | 0 | 0.0% |

## Per bug

| App | Bug | Activated | Verdict | Confidence | Detecting test | Review? |
| --- | --- | --- | --- | --- | --- | --- |
| bookstack | `comment` | no | **not_activated** | — | — | no |
| bookstack | `count_recently_created_books` | yes | **oracle_miss** | — | — | no |
| bookstack | `count_recently_created_chapters` | yes | **oracle_miss** | — | — | no |
| bookstack | `count_recently_created_pages` | yes | **oracle_miss** | — | — | no |
| bookstack | `count_recently_created_shelves` | yes | **oracle_miss** | — | — | no |
| bookstack | `create_book` | no | **not_activated** | — | — | no |
| bookstack | `create_page` | no | **not_activated** | — | — | no |
| bookstack | `create_sort_rule` | no | **not_activated** | — | — | no |
| bookstack | `delete_book` | no | **not_activated** | — | — | no |
| bookstack | `favourite_book` | yes | **oracle_miss** | — | — | no |
| bookstack | `favourite_chapter` | yes | **oracle_miss** | — | — | no |
| bookstack | `favourite_page` | yes | **oracle_miss** | — | — | no |
| bookstack | `favourite_page_template` | yes | **oracle_miss** | — | — | no |
| bookstack | `recent_activity_all` | yes | **oracle_miss** | — | — | no |
| bookstack | `recent_activity_chapter` | yes | **oracle_miss** | — | — | no |
| bookstack | `recent_activity_page` | yes | **oracle_miss** | — | — | no |
| bookstack | `recent_activity_page_template` | yes | **oracle_miss** | — | — | no |
| bookstack | `recent_activity_shelf` | yes | **oracle_miss** | — | — | no |
| bookstack | `recently_viewed_book` | no | **not_activated** | — | — | no |
| bookstack | `recently_viewed_chapter` | no | **not_activated** | — | — | no |
| bookstack | `recently_viewed_page` | no | **not_activated** | — | — | no |
| bookstack | `recently_viewed_page_template` | no | **not_activated** | — | — | no |
| bookstack | `recently_viewed_shelf` | no | **not_activated** | — | — | no |
| bookstack | `search` | yes | **oracle_miss** | — | — | no |
| bookstack | `settings` | no | **not_activated** | — | — | no |
| bookstack | `unfavourite_shelf` | yes | **oracle_miss** | — | — | no |
| bookstack | `update_book` | no | **not_activated** | — | — | no |

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

