# Graph Discovery v2.0 — Limitations & Findings

Run date: 2026-07-28
Model: claude-sonnet-4-6
Repos: brocoders/extensive-react-boilerplate, cypress-rwa, umami
Prompt version: v2.0 (behavioral state model, element-triggered edges)

## Summary

| Repo | Nodes | Edges | Edge/Node | Schema Compliance | Notes |
|------|-------|-------|-----------|-------------------|-------|
| brocoders | 20 | 57 | 2.85 | **FAILED** — invented own format | Rich content but wrong structure |
| cypress-rwa | 38 | 60 | 1.58 | **GOOD** | Best overall quality |
| umami | 85 | 72 | 0.85 | **GOOD** | Sparse edges, inconsistent depth |

## Limitation 1: Schema Non-Compliance (1/3 agents)

Brocoders agent completely ignored the v2.0 JSON schema and produced its own format:
- Used `"type": "page"/"modal"/"panel"/"redirect"` (removed taxonomy)
- Used `"trigger": "link_click"/"button_click"/"form_submit"` (abstract types instead of element descriptions)
- Used slug-based IDs (`"home"`) instead of route-based (`/`)
- No `version` field, no `actions` array

**Root cause:** The prompt defines the format via example JSON + rules. The agent chose what it considered more useful rather than following instructions strictly.

**Potential fix:** Provide a mandatory seed file the agent must extend, or add a schema validation step early that rejects non-conforming output and forces a rewrite.

## Limitation 2: Missing Return/Cross-Section Edges

All three graphs model forward navigation well (clicking links, submitting forms) but fail to model:
- Shared navigation components (sidebar nav links, top nav)
- Return navigation (closing modals → back to parent, browser back)
- Cross-section jumps via persistent UI (sidebar: Websites ↔ Boards ↔ Links ↔ Settings)

This makes graphs appear as trees (many inbound edges, few outbound) rather than actual interconnected graphs.

**Impact:** Test planning can't use the graph to determine "how do I get back from state X" — only "how do I get to state X."

**Potential fix:** Prompt should instruct: "For every state with a persistent sidebar/navbar, add edges to at least the top-level sections reachable from that navigation. For every modal/overlay state, add an edge back to the parent state (close/dismiss action)."

## Limitation 3: Inconsistent Sub-State Depth

Agents model some modals/overlays as `#qualifier` sub-states but skip others on the same page:
- Umami: `/boards#add-board-modal` exists, but `/links#add-link-modal` doesn't (despite identical pattern)
- Cypress-rwa: filter states duplicated per-route (`/#date-range-filter`, `/contacts#date-range-filter`, `/personal#date-range-filter`) despite identical UI

**Root cause:** No clear guidance on when to stop splitting. The behavioral criteria ("different actions available") is correct in theory but agents don't apply it consistently across the full app.

**Potential fix:** Add a consistency rule: "If you model a pattern (e.g., CRUD modal) as a sub-state on one page, model the same pattern on every page where it appears. Conversely, if a component is identical across routes, model it once on the primary route."

## Limitation 4: Transient UI Modeled as States

Cypress-rwa modeled `/#snackbar-success` as a state (3-second auto-dismissing toast). By our definition ("Do NOT create new nodes for loading spinners..."), transient notifications shouldn't be states — they don't change action availability or reachability.

**Potential fix:** Add to exclusions: "auto-dismissing notifications, toasts, snackbars, and alerts that require no user action are NOT distinct states."

## Limitation 5: Redirect-Only Pages as States

Umami modeled `/`, `/settings`, `/admin`, `/boards/create` as states despite having no visible UI — just auto-redirects. These have no meaningful actions to test.

**Potential fix:** Add: "Pages that immediately redirect with no user-visible UI or user-actionable state are NOT distinct states. Note them as edges (auto-redirect) from the referring state to the target state."

## Limitation 6: Actions Lack Element Identifiers

Umami's actions array uses vague descriptions ("Enter username", "Save changes") while cypress-rwa's includes test selectors ("Enter username [data-test=signin-username]"). The trigger field tends to be more specific than the actions array.

**Impact:** The `actions` array is meant to make state identity auditable AND be useful for test generation. Without identifiers, it only serves the first purpose.

**Potential fix:** Prompt should say: "In the actions array, include the most stable element identifier for each action (data-testid, aria-label, visible text). Format: `<verb> <target> [<identifier>]`."

## Limitation 7: No Live UI Interaction

All three runs relied purely on static source analysis. Even when a dev server was running:
- Brocoders verified routes via HTTP GET status codes (not actual UI interaction)
- Cypress-rwa couldn't start the server (Node 25 incompatibility)
- Umami had a server running but the agent never launched a browser to navigate

The "Phase 2 — Live navigation" instructions were effectively ignored. Agents found all routes through source code scanning, which means they miss:
- Dynamically rendered states only visible after specific user interactions
- Server-rendered content differences based on auth state
- Client-side-only state transitions

**Potential fix:** Stronger instruction: "After source analysis, you MUST navigate the running app with a headless browser (playwright/puppeteer) and verify at least 5 states that differ from their source-code description."

## Limitation 8: Trigger Field Specificity Varies

Edge triggers range from excellent (`button 'Sign In' [data-test=signin-submit]`) to generic (`"click team row in TeamsDataTable"`, `"direct URL navigation"`).

When the agent can identify `data-test`/`data-testid` attributes from source, triggers are actionable. When it can't (no test attributes in source), it falls back to generic descriptions.

**Potential fix:** Instruct: "When no data-testid exists, use the next best locator: aria-label, role + visible text, or CSS selector. Never use generic descriptions like 'click row' — always include enough detail for `page.getByRole()` or `page.locator()` to target the element."
