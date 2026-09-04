# WebTestPilot evaluation artifact

Reproducibility artifact for the WebTestPilot detection study: the small inspectable records live
here, the multi-gigabyte execution evidence is distributed as a separate archive (below). Full
per-class accounting is in [MANIFEST.md](MANIFEST.md).

Two baselines are evaluated throughout:

- **`claude-code-baseline`** — the general agent harness generating a suite from the app
- **`playwright-agents`** — the published Playwright test agents (planner → generator → healer)

## Primary vs supplemental

| Directory | Role |
|---|---|
| `headtohead/` (from `results/wtp_headtohead`) | **the primary campaign** — 4 apps × 2 baselines, faults as shipped |
| `relaxed/` (from `results/wtp_relaxed`) | **supplemental** relaxed-trigger experiment: the same fault families re-run with the trigger's literal gate relaxed so more faults actually arm |
| `baseline-pilot/` (from `results/webtestpilot_baseline`) | earlier single-app pilot (BookStack), kept for provenance |
| `selftest/` (from `results/webtestpilot_selftest`) | self-test app used to sanity-check the oracle |

**No detection number from the relaxed experiment is a headline result.** It exists to establish
whether a fault was genuinely on the page (it records `mutation_applied`), not to improve a score.

## The honest detection result

**31 active real defects, 1 caught — 3.2%.**

Reproduce it with `python tools/report_fired_only.py`, which writes
`headtohead/export/08_active_faults.csv`. Verified 2026-09-04: the tool prints
`TOTAL (verified real defects): 31`, `CAUGHT: 1`, `DETECTION RATE: 3.2%`.

Per run, from that table:

| run | active faults | caught | rate |
|---|---:|---:|---:|
| claude-code-baseline / bookstack | 4 | 0 | 0.0% |
| claude-code-baseline / indico | 13 | 0 | 0.0% |
| claude-code-baseline / prestashop | 2 | 0 | 0.0% |
| playwright-agents / bookstack | 1 | 0 | 0.0% |
| playwright-agents / indico | 4 | 0 | 0.0% |
| playwright-agents / prestashop | 7 | 1 | 14.3% |

Strongest subset (tier 1 — WebTestPilot's own mutation, byte-identical, only the trigger literal
relaxed): 15 active, 1 caught, 6.7%.

### What the number does and does not pool

The 31/1 figure counts only faults that **fired**, because a fault that never armed says nothing
about assertion strength. Read the provenance honestly before quoting it:

- The set of fired faults is drawn from the primary campaign's `per_bug.csv` files **and** from the
  relaxed re-runs, because only the re-runs record `mutation_applied` — the check that proves a
  defect was actually on the page. Where the same (baseline, app, fault) appears in both, the
  relaxed record wins as the better-evidenced one. So `31 / 1` is the *fired-fault* result of the
  study, **not** a pure `wtp_headtohead`-only figure; the caught case
  (`playwright-agents / prestashop / seller_delete_product`) is a VERIFIED record whose literal gate
  was relaxed.
- **45 further faults fired in the original campaign before the page-change check existed** and are
  excluded in both directions, 1 of which was caught
  (`claude-code-baseline / prestashop / buyer_add_product_to_cart`, UNVERIFIED as shipped).
  Re-running those with the check active is what would move them into the table.

The primary campaign **as shipped**, counted from `headtohead/*/*/per_bug.csv` with no relaxed data
at all, is:

| evaluations | not activated | activated | oracle miss | incidental failure | caught |
|---:|---:|---:|---:|---:|---:|
| 175 | 126 | 49 | 47 | 1 | 1 |

126 of 175 evaluations never armed, mostly because the fault's trigger demanded the benchmark
author's exact literals or a URL the suite never visited. That is why `caught / 175` is not
reported as an oracle-strength measure, and why the active-fault view exists.

## Where to find things

| What | Path |
|---|---|
| canonical spreadsheet | `headtohead/export/webtestpilot_results.xlsx` (sheets `00_overall` … `07_run_validity`) |
| honest detection table | `headtohead/export/08_active_faults.csv` — a **CSV emitted by `tools/report_fired_only.py`**, not a sheet in the workbook |
| export field guide | `headtohead/export/README.md` |
| generated tests actually executed | `<root>/<baseline>/<app>/generation/frozen/*.spec.ts` (+ `frozen_manifest.json`) |
| exact injected faults | `<root>/<baseline>/<app>/bugs/_prepared/*.js` |
| per-fault verdict evidence | `<root>/<baseline>/<app>/bugs/<fault>/verdict.json` |
| pre-injection profile | `<root>/<baseline>/<app>/clean/clean_profile.json` |
| run-validity caveats | `headtohead/run_validity.csv`, `headtohead/activation_causes.csv`, `headtohead/b_provenance_audit.csv`, `headtohead/oracle_capability.csv` |
| cross-app findings | `headtohead/CROSS_APP_FINDINGS.md`, `headtohead/PHASE1_BOOKSTACK_HEADTOHEAD.md` |
| relaxed variant definitions | `relaxed/variant_diffs.md`, `relaxed/variant_manifest.csv`, `relaxed/relaxed_summary.csv`, `relaxed/relaxed_by_run.csv` |
| generation transcripts | not committed — see `messages_index.csv` and the archive below |

### Order-status presentation example

    relaxed/prepared/prestashop/seller_refund_order.js                                    (829 B)
    relaxed/playwright-agents/prestashop/generation/frozen/backoffice-orders.spec.ts     (8,310 B)

The first is the exact injected fault for the seller refund-order flow in the relaxed variant; the
second is the frozen generated suite for PrestaShop back-office orders that was run against it.
Both are relaxed-experiment artifacts, so treat them as illustration, not as a headline result.

## External raw-evidence archive

    webtestpilot-execution-artifacts-2026-09-04.tar.gz
    SHA-256  96ca398d2c507d4c1175f58f355c6f20d658b237ec73b3c42742f30c359b18ca
    5.5 GB (5,864,965,145 bytes), 5,487 files

Contents: 2,748 Playwright `trace.zip`, 2,723 execution screenshots, 16 generation
`messages.jsonl` transcripts (9,986 messages, 28 MB). Excluded: `node_modules` (17 directories),
browser profiles, `test-results/`, `playwright-report/`, and anything reinstallable.

Verified on creation: `gzip -t` OK; `tar -tzf` lists 5,487 entries with no errors and no
`node_modules`; the archive contains exactly the source evidence set (0 missing, 0 extra); an
extracted trace is byte-identical to its source; `shasum -c` OK. Paths inside are relative to
`results/`, so it unpacks over that tree.

### Credentials appearing in generated tests

The frozen specs contain login literals for the benchmark applications themselves — `password`,
`admin12345`, `mypassword`, `TestPassword123!` and `admin@admin.com`. These are the demo fixtures
of locally deployed benchmark apps and are needed to read the tests; they authenticate nothing
outside a throwaway container. A scan of everything committed here found no API key, bearer token,
private key or cloud credential; API tokens in the InvoiceNinja specs are fetched at runtime, not
embedded. The 64-character hex strings in `messages_index.csv` and `frozen_manifest.json` are
SHA-256 digests.

Transcripts were moved to the archive rather than committed because 16 files total 28 MB, with
single files up to 4.5 MB — large next to the 11 MB of everything else here. `messages_index.csv`
carries each transcript's baseline, app, line count, byte size and SHA-256 so a specific one can be
located and integrity-checked without unpacking the archive.
