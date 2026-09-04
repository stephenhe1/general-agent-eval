# WebTestPilot evaluation — exported results

Regenerate with:

```bash
python tools/audit_b_provenance.py > results/wtp_headtohead/b_provenance_audit.csv
python tools/audit_activation_causes.py
python tools/export_wtp_results.py
```

Everything here is derived from run artifacts (`summary.json`, `per_bug.csv`, the SDK
transcripts) with one deliberate exception: `run_validity.csv` is hand-authored, because whether
a run fairly measures its architecture is an editorial judgement no artifact records.
`webtestpilot_results.xlsx` carries all eight tables as sheets, with verdict cells colour-coded
and filters enabled.

| Sheet | Contents |
| --- | --- |
| `00_overall` | campaign totals, cause breakdown, validity, headline |
| `01_run_summary` | one row per (baseline, app), metrics A-E, cost |
| `02_per_bug` | one row per bug-evaluation |
| `03_provenance` | Baseline B suite authorship |
| `04_verdict_matrix` | fault x run pivot |
| `05_activation_causes` | why each fault never armed |
| `06_counterfactual` | "what if the values had matched?", both bounds |
| `07_run_validity` | per-run validity judgements and their owner |

**Snapshot status:** Baseline A is complete (all 100 faults, 4 apps). Baseline B covers
bookstack + indico; prestashop/B is generated but budget-truncated and its evaluation is still
running, and invoiceninja/B is excluded as invalid. Re-run the three commands above to refresh.
See `07_run_validity` before quoting any B figure.

**Scope note:** this export covers the 6 runs under `results/wtp_headtohead/`. The earlier
bookstack/A *host-isolation* run lives in `results/webtestpilot_baseline/` and is deliberately
excluded, so "armed" totals here (43) are lower than the 58 quoted across all 7 runs in
`CROSS_APP_FINDINGS.md`.

## 00_overall — campaign totals

Sectioned key/value sheet: scope, per-baseline aggregates (metrics A–E, cost), the
`not_activated` cause breakdown, suite provenance, and the headline. Every figure is computed
from the other sheets; none is typed in.

The row **`B' upper bound if values matched`** answers "how many faults would arm if the suite
had used the benchmark's own literals?" It is `(armed + value_difference) / evaluated` — an
**upper bound, not an observed rate**, because it credits every value-coupled fault as though
matching the literal were sufficient. Report it beside Metric B, never instead of it.

## 05_activation_causes — why each fault never armed

`not_activated` is the dominant verdict, and it conflates causes belonging to different parties.
This sheet reads each fault's real `isConditionMet` body out of the prepared bug script and
splits the requirements into paths (`/rooms/book`) and content literals (`January 2025`).

| Cause | Meaning | Whose limitation |
| --- | --- | --- |
| `value_difference` | Every required path is navigated to, but the condition also demands literal content (`January 2025`, `New Meeting`). The suite exercised the scenario and differed only in the data it used. | **benchmark** |
| `coverage_gap` | No navigation call in the suite targets a required path. The suite never went there. | **tool** |
| `navigation_depth` | The condition counts visits in `sessionStorage`. That storage survives `page.goto()` **within one test**, so a single test that leaves the trigger path and returns satisfies it. Reachable — the suite simply never wrote a there-and-back flow. | **tool** |
| `unexplained` | Path navigated, no content or state requirement found, still did not arm. | manual read |
| `indeterminate` | No condition body extractable. | manual read |

Rolled up: **58% benchmark-side** (literal coupling), **35% tool-side** (never navigated there,
or no repeat-visit flow), **7% unresolved**.

### Why `navigation_depth` is attributed to the tool, not the benchmark

An earlier version of this audit called these `shape_or_state` and blamed the benchmark, on the
theory that Playwright's per-test context isolation makes repeat-visit counters unsatisfiable.
That was wrong. `sessionStorage` persists across `page.goto()` inside a single test, so:

```
goto /books        -> count = 1
goto /books/create -> (creates the book)
goto /books        -> count = 2 -> ARMED
```

is a perfectly ordinary flow, and it arms the fault. Only accumulation *across tests* is blocked
by isolation, and no condition in this benchmark needs that. Verified for bookstack
`create_book`: **no test in either suite navigates to `/books` twice**, though nothing stopped
it. That is a gap in generated navigation depth — tests are written as flat single-page visits
rather than round trips.

### Two measurement caveats

* Coverage is judged from navigation calls (`goto`, `waitForURL`, `toHaveURL`), not from the
  path string appearing anywhere in the file. An earlier version matched anywhere and credited
  invoiceninja with visiting `/invoices` when that string was a REST-API endpoint in an
  API-only suite. A navigation call in source is still not proof the test reached that state at
  runtime, so `value_difference` may remain mildly overcounted.
* Storage keys are excluded from content literals. An earlier version counted `__prev_path__` /
  `__visit_count__` as content, reporting ~10 spurious `value_difference` cases in bookstack.
  `uses_visit_state` flags them.

## 06_counterfactual — "what if the values had matched?"

**No verdict is relabelled here, and `value_difference` faults are never counted as `caught`.**
Such a fault never armed: the DOM was never mutated, so there was no defect on the page for any
assertion to reject. Recording it as caught would invent a detection.

Instead the sheet states both bounds explicitly:

| Column | Assumption |
| --- | --- |
| `cf_armed_if_values_matched` | `observed_armed + value_difference` — the activation ceiling if the suite had used the benchmark's literals |
| `cf_caught_OPTIMISTIC` | every newly-armed fault is also detected. Requires believing the suite catches everything it is shown |
| `cf_caught_EVIDENCE_LED` | newly-armed faults are detected at the rate actually measured on faults that did arm: **1/43 = 2.3%** |

Totals: 63 value-coupled faults would raise catches from 1 to **64 under the optimistic
assumption**, or to **≈2.5 under the measured rate**.

That 25× gap is the finding. **Activation and detection are independent failures.** Fixing the
benchmark's literal coupling would raise activation to ~64–81% and still leave detection near
zero, because the suites' assertions verify their own action rather than surrounding state. The
optimistic column is what a naive reading of `value_difference` would imply; the evidence-led
column is what the campaign actually supports.

## 01_run_summary — one row per (baseline, app)

| Column | Meaning |
| --- | --- |
| `baseline` | A = Claude Code baseline (single agent). B = Playwright test agents (planner/generator/healer subagents). |
| `tests_generated` | Tests in the frozen suite. Frozen before any fault was seen; never regenerated. |
| `clean_stable_tests` | Passed in all 3 clean repetitions, with an app reset before each. Only these can produce a verdict. |
| `clean_flaky_tests` | Different results across repetitions. **0 in every run.** |
| `A_clean_stability_rate` | `clean_stable / tests_generated`. Metric A. |
| `bugs_evaluated` | Faults run against this suite. |
| `bugs_activated` | Faults whose injection condition was actually met (sentinel observed). |
| `B_activation_rate` | `activated / evaluated`. Metric B — **a property of the benchmark's trigger design, not of suite quality.** |
| `bugs_caught` | Activated faults that made a clean-stable test fail. |
| `C_conditional_detection_rate` | `caught / activated`. Metric C — the honest oracle-strength measure. |
| `D_end_to_end_detection_rate` | `caught / evaluated`. Metric D — depresses C by the activation ceiling; never report alone. |
| `E_incidental_failure_rate` | Failures not attributable to the fault. **0 everywhere.** |
| `oracle_miss` | Fault armed, suite noticed nothing. The interesting failure class. |
| `not_activated` | Fault never armed. Dominates this benchmark. |
| `environment_error` | Infrastructure failure. **0 across ~200 reset cycles.** |
| `generation_cost_usd` | SDK-reported `total_cost_usd`. Token-derived estimates were wrong by 2–4× and are not used. |
| `provenance_verdict`, `specs_stamped` | Baseline B only — see `03_provenance`. |

## 02_per_bug — one row per bug-evaluation (152 rows)

`candidate_failures` counts failing clean-stable tests; `aligned_failures` counts those the
classifier ties to the fault; `detecting_test` names the test that caught it. A `caught` row
with `aligned < candidate` warrants manual review.

## 03_provenance — Baseline B suite authorship

Two independent signals, because neither is conclusive alone. The `// spec:` header appears
only as an *example* in the generator agent's definition, so its presence is strong evidence
the generator authored a file while its absence is weak evidence that it did not;
`task_started` records naming a planner/generator role are direct evidence of delegation.

`hybrid-partial` means some specs were authored outside the generator — bookstack/B has 6 such
specs, a known confound now fixed in `generate.py`.

## 04_verdict_matrix — fault × run pivot

One row per (app, fault); one column per run. Blank means the run does not cover that app.
Useful for the question the summary rows cannot answer: *do two architectures fail on the same
faults?* Currently **15 of 100 faults** get different verdicts between A and B — and every one
of those disagreements is `oracle_miss` vs `not_activated`, i.e. differences in which scenarios
the suites happened to exercise. **No fault is caught by one architecture and missed by the
other.**
