# WebTestPilot artifact manifest

Every file was copied from `results/` with its path relative to its result root preserved, so
baseline / subject / fault identity is never flattened away. Counts are taken recursively at the
source and verified at the destination by SHA-256.

| Artifact class | Root | Source count | Copied count | Missing | Notes |
|---|---|---:|---:|---:|---|
| export tables + workbook | headtohead (primary) | 11 | 11 | 0 | includes `08_active_faults.csv`, the honest detection table |
| root reports (md) | headtohead (primary) | 2 | 2 | 0 | cross-app findings, variant diffs, pilot notes |
| root tables (csv) | headtohead (primary) | 4 | 4 | 0 | run validity, activation causes, provenance audits, relaxed summaries |
| run + baseline summary.json | headtohead (primary) | 9 | 9 | 0 | per-run and per-baseline totals (both depths) |
| per_bug.csv | headtohead (primary) | 9 | 9 | 0 | per-fault outcome rows, per run and per baseline |
| clean profile | headtohead (primary) | 7 | 7 | 0 | pre-injection baseline profile |
| frozen test manifest | headtohead (primary) | 8 | 8 | 0 | maps frozen specs to their generation run |
| frozen generated specs | headtohead (primary) | 112 | 112 | 0 | the tests actually executed, frozen at generation |
| per-fault verdicts | headtohead (primary) | 175 | 175 | 0 | one per (baseline, app, fault) |
| injected fault scripts | headtohead (primary) | 175 | 175 | 0 | the exact mutation applied per fault |
| root reports (md) | relaxed (supplemental) | 1 | 1 | 0 | cross-app findings, variant diffs, pilot notes |
| root tables (csv) | relaxed (supplemental) | 3 | 3 | 0 | run validity, activation causes, provenance audits, relaxed summaries |
| run + baseline summary.json | relaxed (supplemental) | 8 | 8 | 0 | per-run and per-baseline totals (both depths) |
| per_bug.csv | relaxed (supplemental) | 8 | 8 | 0 | per-fault outcome rows, per run and per baseline |
| clean profile | relaxed (supplemental) | 6 | 6 | 0 | pre-injection baseline profile |
| frozen test manifest | relaxed (supplemental) | 6 | 6 | 0 | maps frozen specs to their generation run |
| frozen generated specs | relaxed (supplemental) | 95 | 95 | 0 | the tests actually executed, frozen at generation |
| per-fault verdicts | relaxed (supplemental) | 70 | 70 | 0 | one per (baseline, app, fault) |
| injected fault scripts | relaxed (supplemental) | 70 | 70 | 0 | the exact mutation applied per fault |
| presentation fault scripts | relaxed (supplemental) | 39 | 39 | 0 | relaxed variants incl. `prestashop/seller_refund_order.js` |
| root reports (md) | baseline-pilot | 4 | 4 | 0 | cross-app findings, variant diffs, pilot notes |
| root tables (csv) | baseline-pilot | 3 | 3 | 0 | run validity, activation causes, provenance audits, relaxed summaries |
| run + baseline summary.json | baseline-pilot | 3 | 3 | 0 | per-run and per-baseline totals (both depths) |
| per_bug.csv | baseline-pilot | 3 | 3 | 0 | per-fault outcome rows, per run and per baseline |
| clean profile | baseline-pilot | 2 | 2 | 0 | pre-injection baseline profile |
| frozen test manifest | baseline-pilot | 2 | 2 | 0 | maps frozen specs to their generation run |
| frozen generated specs | baseline-pilot | 27 | 27 | 0 | the tests actually executed, frozen at generation |
| per-fault verdicts | baseline-pilot | 30 | 30 | 0 | one per (baseline, app, fault) |
| injected fault scripts | baseline-pilot | 30 | 30 | 0 | the exact mutation applied per fault |
| root reports (md) | selftest | 3 | 3 | 0 | cross-app findings, variant diffs, pilot notes |
| root tables (csv) | selftest | 2 | 2 | 0 | run validity, activation causes, provenance audits, relaxed summaries |
| run + baseline summary.json | selftest | 1 | 1 | 0 | per-run and per-baseline totals (both depths) |
| per_bug.csv | selftest | 1 | 1 | 0 | per-fault outcome rows, per run and per baseline |
| clean profile | selftest | 1 | 1 | 0 | pre-injection baseline profile |
| frozen test manifest | selftest | 1 | 1 | 0 | maps frozen specs to their generation run |
| frozen generated specs | selftest | 5 | 5 | 0 | the tests actually executed, frozen at generation |
| per-fault verdicts | selftest | 4 | 4 | 0 | one per (baseline, app, fault) |
| injected fault scripts | selftest | 4 | 4 | 0 | the exact mutation applied per fault |
| **total** | | **944** | **944** | **0** | |

## Verification performed

- Recursive scan of all four result roots: 944 files matched, 944 present in the artifact,
  **0 missing**, **0 content mismatches**.
- A first pass used fixed-depth globs (`*/*/summary.json`) and silently missed **92 files** —
  the per-baseline aggregates at `<root>/<baseline>/summary.json` and `per_bug.csv`, and the whole
  of `webtestpilot_baseline` / `webtestpilot_selftest`, which nest as `<app>/bugs/...` with no
  baseline level. The recursive definition above is what the counts and the copy now use.
- No destination collision differed in content, so nothing was overwritten and no fault, test or
  verdict record was dropped.
- Paths preserved as `<alias>/<original path relative to the result root>`, so
  `headtohead/playwright-agents/prestashop/bugs/<fault>/verdict.json` still names baseline,
  subject and fault.
- Never matched by any class glob, therefore absent by construction: `node_modules/`,
  `test-results/`, `playwright-report/`, `.cache/`, `trace.zip`, screenshots.

## Deliberately not committed

| Content | Size | Where it went |
|---|---|---|
| Playwright traces (2,748 `trace.zip`) | 5.70 GB | external archive |
| Execution screenshots (2,723 PNG) | 0.28 GB | external archive |
| Generation transcripts (16 `messages.jsonl`, 9,986 messages) | 28 MB | external archive; indexed in `messages_index.csv` |
| `node_modules/` (17 dirs), browser profiles, `test-results/`, `playwright-report/` | — | not archived: reinstallable or transient |

`messages_index.csv` gives each transcript's baseline, app, line count, byte size and SHA-256, so
one transcript can be located and checked inside the archive without unpacking 6 GB.

