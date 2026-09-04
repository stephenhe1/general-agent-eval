# WebTestPilot injected-bug evaluation — cross-application findings

Autonomously generated Playwright suites, frozen before any fault was seen, run against
WebTestPilot's injected faults under container isolation. Two agent architectures, four
applications, ~200 reset-and-reseed cycles.

**Baseline A has now covered the complete benchmark: all 100 faults across all four
applications.** Baseline B has covered 52 of 100 (bookstack, indico); prestashop is in
generation, invoiceninja is recorded invalid.

## Results

| Subject | Generator | Tests | Clean stability | Activation | **Caught** |
| --- | --- | --- | --- | --- | --- |
| bookstack | A (host) | 69 | 98.6% | 15/27 — 56% | 0 |
| bookstack | A (container) | 69 | **100%** | 15/27 — 56% | 0 |
| bookstack | B (Playwright agents) | 36 | **100%** | 16/27 — 59% | 0 |
| invoiceninja | A | 71 | 94.4% | **0/25 — 0%** | 0 |
| indico | A | **92** | **100%** | 4/25 — 16% | 0 |
| indico | B | 34 | 97.1% | 4/25 — 16% | 0 |
| **prestashop** | **A** | 90 | 95.6% | 4/23 — 17% | **1** |

**Baseline A, complete benchmark (100 faults): 23 armed, 1 caught.**
End-to-end detection **1%**; conditional detection **4.3%**.

Across all 7 valid runs: 179 bug-evaluations (bookstack A counted twice, host + container),
58 armed, **1 caught**. Distinct faults covered: 100/100 by A, 52/100 by B.
**Zero flaky tests in any clean run.** Zero environment errors in ~200 reset cycles.

Generation cost (SDK-reported, not estimated): indico $2.88 · bookstack A $5.50 ·
bookstack B $10.11 · invoiceninja B $10.88 · invoiceninja A $11.76. Cost tracks how hostile the
app's DOM is: the server-rendered Python app was a third the price of the JS SPA and produced
more tests.

## Finding 1 — the oracle weakness is real, specific, and now has a positive control

Of the **58 faults that armed** across all runs, exactly **one** was caught. That single catch is
the most informative data point in the campaign, because it discriminates the mechanism rather
than merely confirming a null result.

> Generated tests verify the effect of **their own action**. They detect faults in the entity
> their action targets, and are structurally blind to collateral damage to entities the test
> never names.

**The catch — prestashop `buyer_add_product_to_cart`.** The fault removes the last `<li>` from
`ul.cart-items`: i.e. the item the test just added. The test asserts
`expect(getByText(/Hummingbird printed t-shirt/i).first()).toBeVisible()` and fails.
Actor and victim coincide — the one configuration the theory predicts *should* be detectable.

**The misses** — 57 armed, none caught. In every miss I inspected directly, the fault
corrupts a neighbour of the entity under test:

* **A**, BookStack dashboard: `expect(entityItems.first()).toBeVisible()` — "at least one item
  exists". A fault injecting a phantom book leaves that true.
* **B**, BookStack favourites: `expect(page.getByText('Book2')).toBeVisible()` — a stronger,
  entity-named assertion. But the fault removes the pre-seeded `Shelf`, not Book2. Also true.
* **A**, prestashop `buyer_search_product`, `buyer_contact_us`, `buyer_view_store_information` —
  armed, and the suite has tests on all three pages. Each test verifies its own navigation
  succeeded, not that unrelated page furniture survived.

So the split is clean and predictive:

| Fault targets… | Armed | Caught |
| --- | --- | --- |
| the entity the test acts on | 1 | **1** |
| a neighbouring entity | 57 | **0** |

The "neighbouring entity" characterisation is verified by inspection for the cases listed above,
not audited across all 57 — the counts are exact, the causal attribution is a sampled read.

Detecting the second class needs count assertions, full-list comparison, or invariants over what
must *not* change. Neither architecture produces those spontaneously -- and the assertion census
shows why. Across the five evaluated suites, `toHaveCount` appears **0, 11, 1, 4 and 0** times
against **46-98** `toBeVisible` each. These are visibility suites.

That has a hard consequence, because the faults divide by what they do to the DOM
(`tools/audit_oracle_capability.py` -> `oracle_capability.csv`):

| Mutation | All faults | Armed | Caught | Catchable by a visibility assertion? |
| --- | --- | --- | --- | --- |
| removes an element | 73 | 23 | **1** | yes, if the suite asserts on that element |
| inserts a phantom element | 39 | 5 | 0 | **no -- structurally impossible** |
| changes text | 38 | 13 | 0 | only with a text assertion |

Adding an element leaves every existing element visible, so no visibility assertion can reject
it. **39 of the benchmark's faults are invisible to a visibility-only suite regardless of what
values or paths the tests used.** The single catch in the whole campaign is a removal -- of the
element the test had itself just created and named.

**A prompt instruction did not fix it.** The strengthened behavioural-postcondition requirement
was in force for A's container run. The agent wrote a coverage tracker claiming 52/52 and still
produced eight visibility-only dashboard tests. B's better assertions came from the planner's
structured *Expected Result* field — i.e. assertion quality here is architectural, not
promptable.

### A negative result about static oracle analysis

A static checker was built to ask "does the suite assert on the element this fault damages?",
then calibrated against the 43 faults where the answer is known:

| Static label | n | Actually caught | Precision |
| --- | --- | --- | --- |
| `victim_mentioned` | 31 | **0** | **0%** |
| `victim_not_asserted` | 11 | 1 | 9% |

The signal is not merely weak, it is **anti-correlated** -- the one genuine catch fell in the
"not asserted" bucket, because that test asserted on the product *name* rather than on the
`cart-items` class the mutation targets. "The suite looks at that element" says nothing about
whether it would reject a change to it, since `toBeVisible` passes on a corrupted-but-present
element. The column is retained as `victim_mentioned` with its measured precision recorded, and
must not be used to claim a fault "would have been caught". What survives is the structural
argument above, which needs no token matching.

## Finding 2 — `caught / 100` is not a valid measure on this benchmark

Across all four apps, `not_activated` dominates: **12/27** (bookstack A), **11/27** (bookstack B),
**25/25** (invoiceninja), **21/25** (indico, both baselines), **19/23** (prestashop). Faults are far
harder to *arm* than to *detect*, and the reasons are mostly benchmark-side.

Baseline A's complete-benchmark figure makes this concrete: of 100 faults, **77 never armed at
all**. The 1% end-to-end detection rate is therefore composed of a 23% activation ceiling and a
4.3% conditional miss rate — reporting it as a single number attributes to the generator a
limitation that is three-quarters benchmark-side.

Three distinct causes, all observed:

| Cause | Instance | Whose limitation |
| --- | --- | --- |
| Coverage gap | A wrote no comment test | the tool's |
| Trigger-shape mismatch | `create_book` fires only on a 2nd visit to `/books` in one browser context; Playwright isolates contexts per test | the benchmark's |
| Data / seed-state coupling | B wrote a *correct* comment test typing "This is a test comment"; the fault requires the literal "I like this template" | the benchmark's |

**Two independent architectures converge on identical activation.** indico A (92 tests) and
indico B (34 tests) both armed exactly 4/25 — suites differing 2.7x in size, written by different
architectures, hitting the same ceiling. prestashop A repeats the pattern at 4/23. Activation is a
property of the benchmark's trigger design, not of the suite.

The decisive case is **indico**. It had every advantage — 92 tests, 100% clean stability, the
cheapest generation, and 13 specs mapping nearly one-to-one onto the bug families (event
creation, editing, deletion, viewing, admin, room booking, survey, profile). Activation was
still **16%**, because **14 of its 25 triggers require the literal `January 2025`** month
heading, a seeded-date artifact. No autonomously generated test has reason to navigate to that
month view, however well it covers the features.

So the limiting factor is neither oracle strength nor feature coverage: it is whether the suite
reproduces the benchmark author's **navigation path and seed-date context**. Any technique
scored on the raw 100 is largely being measured on that, not on test quality.

Note the audit's `trigger_literal_coupled` figure (29/100) **undercounts** this: it only counts
literals that also appear in the specification text, and `January 2025` is seed data, not spec
text. True coupling is materially higher.

## Finding 3 — two of four applications are structurally problematic

* **prestashop** cannot be deployed on Apple Silicon as shipped: `mysql:5.7` publishes no arm64
  image and the app pins `linux/x86_64`. Under QEMU, PHP's ICU transliterator returns null
  (HTTP 500 on every page); under Rosetta, Apache children segfault. It runs only with the app
  container rebuilt natively for arm64 — a recorded deviation.
* **invoiceninja** defeated UI generation twice. Baseline A explored the UI, abandoned it and
  tested the REST API instead (71 tests, **0/25 armed** — outside the benchmark's observable
  domain, since faults are injected into the DOM). Baseline B's planner produced good plans but
  the generator subagent never ran, leaving a hybrid suite that is not valid as Baseline B.

## Suite provenance audit (Baseline B)

`tools/audit_b_provenance.py` -> `b_provenance_audit.csv`. Two independent signals, because
neither is conclusive alone: the `// spec:` header appears only as an *example* in the generator
agent's definition, so presence is strong evidence the generator authored a file while absence is
weak evidence that it did not; `task_started` descriptions naming a planner/generator role are
direct evidence of delegation.

| App | Specs | Stamped | Planner tasks | Generator tasks | Verdict |
| --- | --- | --- | --- | --- | --- |
| bookstack | 36 | 30 (83%) | 2 | 6 | hybrid-partial |
| indico | 9 | 9 (100%) | 0 | 0 | review |
| invoiceninja | 9 | 0 | 0 | 0 | **invalid — no delegation** |
| prestashop | 20 | 0 | 2 | 2 | ambiguous (audited mid-generation) |

* **invoiceninja/B's invalid label is independently corroborated** — both signals agree. It was
  originally applied by hand.
* **indico/B is stamped 9/9** but its transcript records no role-named delegation. Its 13
  `task_started` records carry no `subagent_type` field at all, i.e. the capture shape differs
  from prestashop's, so absence here is not evidence of absence. Treated as valid on the
  strength of the stamps.
* **prestashop/B's signals disagree**: delegation is documented (2 planner, 2 generator tasks
  naming plans) but no spec carries a stamp. Delegation demonstrably occurred; the generator
  simply did not follow the header convention. Not grounds for invalidation.

**The stamp is a convention, not a contract.** Any future validity gate should key on
delegation records, with stamps as corroboration only.

## Instrument validation

`0 caught` is not an instrument failure. A deliberate 2-test control, aimed at what one fault
actually corrupts, returned **`caught`** through the same injector, fixture and classifier —
`high` alignment confidence, with the fault's own literal (`1 year ago`) in the failure text.

**A 2-test suite caught what a 69-test suite missed.** Detection is aim, not volume.

## Known limitations of this campaign

* **bookstack/B ran with contradictory prompts** — the packaged system prompt told the agent to
  write and validate tests itself while the driver prompt told it to delegate. The provenance
  audit shows the confound reached the artifacts: **30 of 36 specs** carry generator provenance,
  so six were authored outside the generator. (An earlier draft of this document said 36/36;
  that was wrong.)
  Fixed afterwards in `generate.py`, which now forces `system_prompt_config="none"` for this
  generator unconditionally — so indico/B and prestashop/B carry the fix and bookstack/B is the
  only affected run. It should be repeated before publication (script staged at
  `/tmp/scale/rerun_bs_B_fixed.sh`, writing to a separate results-root).
* **invoiceninja/B is recorded invalid** (`generator: playwright-agents-HYBRID-INVALID`) and was
  not evaluated.
* **prestashop/A carries 4 deterministic clean failures** (back-office Discounts/Cart-Rules
  pages). The classifier excludes them from every verdict, so they cannot manufacture a catch,
  but 4 of 90 tests contribute no detection capability. Recorded, not deleted.
* **prestashop/B is budget-truncated.** Generation stopped on the `--max-budget-usd 12` cap at
  `total_cost_usd 12.05`, so the healer ran roughly 2 rounds against bookstack/B's 18. **52 of
  99 tests fail deterministically on the clean app** (broken locators, `selectOption` API misuse,
  strict-mode violations), leaving 47 usable -- the worst clean stability in the campaign, at
  47.5%. Activation figures stay valid because activation depends on navigation rather than
  assertions; clean-stability and detection figures do not represent the architecture. A fair
  re-run needs roughly $25-30. This is a harness limitation, not a finding about the tool.
* Per-run validity judgements are recorded as data in `run_validity.csv` and surfaced in the
  workbook (`07_run_validity`, plus a block in `00_overall`) so caveats travel with the numbers.
  **4 of 8 runs need a caveat or re-run, and 3 of those 4 are harness-side.**
* **prestashop's single catch is a low-confidence, review-required verdict** by the classifier's
  own alignment heuristic. I verified it by hand — the fault deletes the exact `<li>` the test
  asserts on — but it is one instance, not a rate.
* Cost figures earlier in the campaign were hand-estimated and wrong by up to 2–4×; all figures
  here are the SDK's own `total_cost_usd`.

## Recommendation

Report activation (B) and conditional detection (C) alongside end-to-end detection (D). D alone
attributes benchmark-side trigger coupling to oracle weakness. On this evidence the honest
summary is: **current agentic generators produce stable, broad suites that verify their own
actions and are structurally blind to collateral state corruption — and WebTestPilot can only
observe a minority of its own faults against any suite it did not author.**

The prestashop catch converts this from a null result into a mechanism claim with a positive
control: when the fault and the test's own target coincide, detection works. That is the lever to
pull — make generators assert over state they did *not* touch (counts, list invariants,
before/after diffs of untouched regions) — and it is testable directly, without waiting on
benchmark redesign.
