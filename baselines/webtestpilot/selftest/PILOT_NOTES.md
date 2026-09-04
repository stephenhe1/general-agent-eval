# Pilot validation record

What the pilot establishes about the evaluation harness, and what it does not.

## Blocker: no container runtime on this machine

The four benchmark applications are Docker Compose stacks (`webapps/<app>/docker-compose.yaml`
against prebuilt `linux/amd64` images). This machine has no Docker Desktop,
OrbStack, colima, podman, or nerdctl — `docker` is not on `PATH`. So **BookStack
could not be booted**, and the BookStack pilot §15 asks for could not be run.

Everything that does not require booting BookStack was built and validated. The
harness is complete and waiting on a runtime.

## What was validated, and how

The mechanism was exercised two ways:

1. **Live pilot** against a self-test application
   (`resources/wtp-selftest/server.js`, port 8099) that reproduces the DOM
   contracts three *real, unmodified* BookStack bug scripts key on. The bug
   scripts come straight from `benchmark/bookstack/bugs/` through WebTestPilot's
   own `prepare_bug_script`.
2. **Unit tests** (`tests/webtestpilot/`, 29 passing) for the classification and
   freeze/isolation logic, including the two verdict classes the live pilot did
   not produce naturally.

### §15 checklist

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Generation cannot access benchmark files | **validated** | The sanitized workspace contains exactly 4 files: `package.json`, `playwright.config.ts`, `APP_NOTES.md`, `.gitignore`. `audit_workspace` scans for 10 forbidden markers and returns `clean=true`; a pre-generation audit *fails the run* if it does not. Tests `test_audit_flags_leaked_bug_script`, `test_audit_flags_leaked_benchmark_spec`, `test_transcript_audit_detects_benchmark_access`. |
| 2 | Suite is stable on the clean app | **validated (self-test app)** | 3 clean repetitions with a reset+reseed before each: 6 stable / 1 failing / 0 flaky of 7 tests. Not yet shown on real BookStack. |
| 3 | Sentinel correctly observed | **validated** | `activation.ndjson` per run records `armed` plus the channel. Two independent channels fired: `probe` (in-page binding) and `teardown-sweep` (live-page sessionStorage read). |
| 4 | A known bug can be shown to trigger | **validated** | `create_book` and `recent_activity_all` both armed and produced the exact DOM change their `onConditionMet` writes — `Original Description` → `Bad Description`, and the activity timestamp → `1 year ago`. Both appear in the failing assertions' expected/received diffs. |
| 5 | The exact frozen suite is reused | **validated** | `frozen/` is SHA-256 hashed at freeze time; `verify_frozen` re-hashes before every evaluation and aborts on any difference. The clean arm and all 4 bug arms ran the *same* instrumented tree; only `WTP_BUG_SCRIPT` differed. |
| 6 | Pre-existing developer tests excluded | **validated** | The evaluator config sets `testDir` to the instrumented copy of the generated directory only. `test_find_generated_dir_ignores_node_modules_and_legacy_tests` proves discovery skips `tests/legacy/` and vendored `node_modules/**/rq6-agent/`. The prompt change also scopes the agent's own validation to `npx playwright test rq6-agent/`. |
| 7 | Injection survives navigation | **validated** | `create_book`'s trigger fires only on the *second* entry to `/books`, counted in `sessionStorage` across navigations. The detecting test navigates `/ → /books → / → /books`; the fault fired on the fourth navigation, so `addInitScript` persisted throughout. |
| 8 | Verdicts distinguish all four outcomes | **validated** | Live: `not_activated` (`comment`), `caught` (`create_book`, `recent_activity_all`), `oracle_miss` (`search`). Unit-tested: `incidental_failure` (timeout/runtime-only failures) and `environment_error`. A clean-failing test was excluded from evidence in every bug run — `test_clean_failing_test_cannot_detect_a_bug`. |

### The four live verdicts

| Bug | Trigger style | Activated | Verdict | Why |
| --- | --- | --- | --- | --- |
| `comment` | content literal (`"I like this template"`) | no | `not_activated` | The suite added a comment with its own wording, so `isConditionMet` never matched. Correctly *not* an oracle failure — but still counts against the primary metric. |
| `create_book` | stateful visit count (2nd entry to `/books`) | yes | `caught` | A test asserting the book description across a revisit failed on `toContainText`; `Bad Description` matched the fault's fingerprint → high confidence. |
| `recent_activity_all` | DOM presence (`#recent-user-activity h5`) | yes | `caught` | A test asserting the recorded activity time failed; the rewritten timestamp appears in the diff. |
| `search` | content literal on a detail page | yes | `oracle_miss` | The fault fired, but the only test visiting that page asserted the title and never the page list it corrupts. |

`clean_stability_rate` 85.7%, `bug_activation_rate` 75%, `conditional_fault_detection_rate` 66.7%, `end_to_end_fault_detection_rate` 50%.

**These numbers measure the harness, not the baseline.** The suite is a probe
suite written to span the verdict classes, and the target is not a benchmark
application. `summary.md` prints a banner saying so, driven by
`suite_provenance` and `is_selftest_target`.

## Layer 2: a real autonomous Claude Code generation run

The harness was also exercised with a genuine agent run (host isolation, `sonnet`,
`--mode baseline`, packaged prompts) against the same self-test application, to
validate the generation path rather than just the injection path.

- The agent produced **6 spec files, 40 tests**, plus a `UI_COVERAGE.md` tracker.
- **Clean stability: 40/40 (100%)** across 3 reset-and-reseed repetitions.
- **The §3A prompt change worked:** every validation command the agent ran was
  `npx playwright test rq6-agent/` — 2 of 2 unique forms scoped. It never invoked
  the bare suite.
- Verdicts: `comment` not activated; `create_book`, `recent_activity_all`, and
  `search` all **activated but oracle_miss**. End-to-end detection 0/4.

Results in `results/webtestpilot_selftest_generated/`.

### The misses are genuine, and instructive

I checked each one against the frozen source rather than trusting the classifier:

- **`recent_activity_all`** rewrites an activity item's timestamp. The agent's
  `seeded activity items are displayed` test asserts the item *count*, both book
  links, and both action labels — but never the timestamp. The fault fired inside
  that very test and the oracle accepted it.
- **`search`** renames `Page 1` → `Page 3`, but only once `h1.break-text` reads
  `Book2`. The agent *did* assert `getByText('Page 1')` — in its **book1** detail
  test, where the trigger does not match. The book2 test, where the fault fired,
  asserts only title and description.
- **`create_book`** rewrites a book description, but only on the *second* entry to
  `/books` within one browser context. The agent *did* assert
  `getByText('Original Description')` on the books list — but Playwright gives each
  test a fresh context, and that test enters `/books` once, so the trigger never
  reached count 2. The fault fired only in the create-book count test, which
  asserts the count and the new card, not the seeded description.

The methodological point: **fault activation and oracle presence must coincide
inside a single test.** Two of these three suites contained an assertion that
would have caught the fault, in a test where the fault could not fire. Per-test
context isolation interacts directly with WebTestPilot's `sessionStorage`-based
stateful triggers. Worth designing the real experiment around — and worth
reporting separately from a plain "oracle too weak" conclusion.

### A real leakage finding

The transcript audit flagged the host-mode run as **not clean**: the agent read
`resources/wtp-selftest/server.js`, whose header docstring at the time named the
evaluation harness. Consequences:

- It gained white-box knowledge of the app, including the `POST /__reset`
  endpoint, which it then called in its own `beforeEach` hooks. That is part of
  why clean stability was 100%.
- It did **not** read any benchmark bug, specification, or ground truth, and it
  still chose its own comment wording rather than the benchmark literal.
- Fixed: the docstring is now neutral and points at the evaluator README instead.
- For the four real benchmark applications this vector does not exist — they are
  prebuilt Docker images with no source in the tree — and `--isolation docker`
  removes it structurally.

This is exactly the failure mode host mode was documented as unable to prevent,
and the audit caught it rather than passing silently.

## Corrections to two numbers quoted earlier in this thread

Both came from ad-hoc greps, not a reproducible audit. `general-agent-eval-wtp
audit` now produces `benchmark_audit.csv` over all 100 bugs; the honest figures:

- **"98/100 ground_truth assertions cannot detect the bugs"** — not established,
  and overstated. What the audit shows is the *assertion style* of each final-step
  `ground_truth`: 78 visibility, 20 text-content, 1 aria-snapshot, 1 other.
  Whether any of them would pass under injection requires execution; only 3 were
  checked by hand. The `caveat` field in `benchmark_audit_summary.json` records
  this limitation.
- **"76/100 bugs depend on exact literals"** — the loose regex behind that number
  counted CSS selectors and console strings. With a content-literal filter and a
  requirement that the literal also appear in the specification text, the
  reproducible figure is **29/100** trigger-literal-coupled.

One audit result worth keeping: **all 100 bug scripts splice cleanly** through
the official injector (`prepared_script_failures: 0`), so none will silently
fail to install.

## Remaining limitations

- **Not run on a benchmark application.** Needs Docker. Every other layer is done.
- **Host-mode isolation is evidence, not proof.** `--isolation docker` gives the
  structural guarantee; on the host, the workspace is sanitized and the
  transcript audited, but the agent *could* read elsewhere. The guarantee level
  is recorded in `generation.json`.
- **Behaviour alignment is auto-classified.** `caught` requires an assertion
  failure, not merely any failure, and literal matching raises confidence — but
  `review_queue.md` exists because the automatic signal narrows the review set
  rather than replacing review.
- **Serial execution.** `workers: 1, retries: 0` is required for stateful apps and
  makes a 100-bug sweep slow: 1 generation + 3 clean runs + 25ish bug runs per
  app, each preceded by a full `docker compose down -v` + reseed.
