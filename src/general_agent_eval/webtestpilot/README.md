# WebTestPilot injected-bug evaluation

Measures how many of WebTestPilot's 100 injected faults an **autonomously
generated** Playwright suite can expose.

The unit of evaluation is a whole application, not a benchmark test case:

```
clean app ──▶ generic Claude Code harness ──▶ complete Playwright suite ──▶ FREEZE
                                                                             │
                        ┌────────────────────────────────────────────────────┘
                        ▼
        same frozen suite ──▶ clean app  × 3   (stability baseline)
        same frozen suite ──▶ app + bug_1
        same frozen suite ──▶ app + bug_2   ...
```

The agent is never shown a WebTestPilot specification, bug script, or ground
truth. It generates an ordinary application-level suite; the benchmark then acts
on that suite from the outside.

## Commands

```bash
# 1. Static, reproducible audit of the benchmark (no app or agent needed).
general-agent-eval-wtp --wtp-root /path/to/WebTestPilot audit

# 2. Generate + freeze one application's suite.
general-agent-eval-wtp --app bookstack --model sonnet \
  --run-dir results/webtestpilot_baseline/bookstack/run_1 generate

# 3. Clean stability + every bug, against the frozen suite.
general-agent-eval-wtp --app bookstack \
  --run-dir results/webtestpilot_baseline/bookstack/run_1 evaluate

# 2+3 in one shot
general-agent-eval-wtp --app bookstack --model sonnet pilot
```

Restrict the bug set with repeated `--bug NAME`. `--clean-reps` controls the
stability repetitions (default 3).

## Modules

| Module | Responsibility |
| --- | --- |
| `apps.py` | Registry of the four benchmark apps plus the self-test target. `verify_against_artifact` re-derives ports/credentials from the artifact with `ast` so the mirror cannot drift. |
| `bugs.py` | Bug discovery. Delegates to WebTestPilot's own `prepare_bug_script`; extracts the fault's content literals for alignment signal. |
| `workspace.py` | Builds the sanitized generation workspace and audits it (and the agent transcript) for benchmark leakage. |
| `freeze.py` | Locates the generated dir, freezes it with SHA-256 hashes, and builds the instrumented copy. |
| `generate.py` | Drives the existing `claude_code` harness in `--workload javascript --mode baseline`. |
| `runner.py` | App reset/health-gate and one execution of the frozen suite; parses Playwright's JSON report and the activation NDJSON. |
| `classify.py` | Clean-stability profiling and the five-way verdict. |
| `report.py` | `per_test.csv`, `per_bug.csv`, `summary.json`, `summary.md`, `review_queue.md`. |
| `assets/wtp_fixture.ts` | Playwright fixture that injects the fault and observes the sentinel. |
| `assets/wtp.config.ts` | Evaluator config: scoped `testDir`, 1280x720, serial, no retries, JSON reporter. |

## How injection works

WebTestPilot's official injector is reused verbatim: `prepare_bug_script` splices
a bug's `isConditionMet`/`onConditionMet` into `baselines/bug_injector.js`, which
fires `onConditionMet` exactly once and records
`sessionStorage.__BUG_INJECTOR_TRIGGERED__`.

The generated tests are **not** rewritten in place. After freezing, an
instrumented copy is built in which only the module specifier
`'@playwright/test'` becomes `'./__wtp_fixture'`. The fixture re-exports
everything from the real module, so semantics are unchanged. That same
instrumented tree runs both arms; the only difference is the `WTP_BUG_SCRIPT`
environment variable. The fixture:

* calls `context.addInitScript(bugScript)` so injection survives every navigation;
* `page.evaluate`s the script once for an already-loaded page, as WebTestPilot's
  own runner does;
* wraps `browser.newContext` so contexts the tests create themselves are covered;
* installs a **separate** observation-only probe that mirrors the sentinel out
  through a binding, so activation is not lost if a tab closes, and sweeps live
  pages at teardown as a second channel.

## Verdicts

| Verdict | Meaning |
| --- | --- |
| `caught` | Fault activated, a **clean-stable** test failed, and the failure is an assertion rejecting observed state. |
| `oracle_miss` | Fault activated, the suite ran, no clean-stable test failed. |
| `not_activated` | The suite never satisfied the injection condition; the sentinel stayed unset. Counts as not detected end-to-end. |
| `incidental_failure` | Fault activated and a clean-stable test failed, but only via timeout/runtime error. Never counted as caught. |
| `environment_error` | Infrastructure prevented a valid run. |

A test that is failing or flaky on the clean application is excluded from
evidence: it can never "detect" a fault.

Verdicts are **automatic**. `caught` without a matching fault literal, and every
`incidental_failure`, are flagged `review_required` and listed in
`review_queue.md` with the failing assertion, the fault's fingerprint, and the
benchmark's NL expectation, for human confirmation. Source-level comparison
against the benchmark's `ground_truth` is never performed — a generated oracle may
use any locator or assertion style.

## Metrics

* **A. Clean stability rate** — clean-stable ÷ generated tests
* **B. Bug activation rate** — activated ÷ all bugs
* **C. Conditional fault detection rate** — caught ÷ activated
* **D. End-to-end suite fault detection rate** — caught ÷ all bugs *(primary)*
* **E. Incidental failure rate** — incidental ÷ activated

## Isolation guarantees

`--isolation docker` (requires a container runtime) mounts only the staged
workspace, so the benchmark is absent from the agent's filesystem and leakage is
structurally impossible.

`--isolation host` still builds a sanitized workspace outside the benchmark tree
and audits it, but a host-mode agent could read any path the user can. It
therefore adds a post-hoc transcript audit. A clean transcript is *evidence* of
no leakage, not proof of impossibility. `generation.json` records which guarantee
level applied.

## Self-test target

`resources/wtp-selftest/server.js` reproduces the DOM contracts that three real
BookStack bug scripts key on, so the harness can be exercised without Docker:

```bash
node resources/wtp-selftest/server.js &          # port 8099
general-agent-eval-wtp --app selftest --bug-app bookstack \
  --base-url-override http://127.0.0.1:8099 \
  --reset-command 'curl -sf -X POST http://127.0.0.1:8099/__reset >/dev/null' \
  --bug recent_activity_all --bug create_book --bug comment --bug search pilot
```

It is **not** BookStack. Results against it validate the harness and must never
be reported as baseline results — hence the separate `selftest` app name and the
`is_selftest_target` flag in `summary.json`.
