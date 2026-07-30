# UI Coverage (Discovery: 79/79)

Legend: [ ] found but not yet explored  -  [x] explored and confirmed  -  [~] unreachable (reason)

> **Application:** Umami Analytics — open-source, privacy-focused web analytics platform (Next.js 15 App Router).  
> **Default credentials:** username `admin`, password `umami`  
> **Seed data:** 1 website ("Test Website" at `dc1301a1-8c3d-4c91-b74d-359f5a12ff9f`), 1 admin user.  
> **Team routing note:** All `/teams/:teamId/*` URLs are rewritten to `/*` by Next.js config; the same page components handle both team-scoped and personal contexts. `teamId` is extracted from the URL path and used to scope API calls.

---

## Authentication

- [x] `/login` — Login page; username + password form; redirects to `/websites` on success; hidden when `DISABLE_LOGIN` or `CLOUD_MODE` env set
- [x] `/logout` — Logout page; clears session/token then redirects to `/login`; hidden when `DISABLE_LOGIN` or `CLOUD_MODE` env set
- [x] `/sso?token=...&url=...` — SSO redirect handler; stores auth token then navigates to `url`; always renders a full-screen loader briefly

---

## Root / Navigation

- [x] `/` — Root page; no UI, immediately redirects to `/websites` or `/teams/:lastTeamId/websites` based on localStorage

---

## Dashboard

- [x] `/dashboard` — Personal dashboard (board view); shows configured board components or empty-state prompt; only accessible outside team context (team context redirects away)
- [x] `/dashboard/edit` — Dashboard settings; configure name and board layout; back-link to `/dashboard`
- [~] `/teams/:teamId/dashboard` — Redirected by Next.js config to `/dashboard` (permanent: false); team context dashboard not available

---

## Boards

- [x] `/boards` — Boards listing; data table of boards with add/delete actions
- [x] `/boards/create` — Create board redirect; immediately redirects back to `/boards` (board creation happens via modal on the list page)
- [x] `/boards/[boardId]` — Board view page; renders board components (metrics bars, charts, tables, world map, text blocks, weekly traffic); date/filter controls; share button
- [x] `/boards/[boardId]/edit` — Board settings page; edit name/description; manage share URLs (create/revoke); back-link to board view
- [x] `/boards/[boardId]/design` — Board layout designer; drag-and-drop grid editor to add/remove/resize components; component picker (metrics bar, visitors chart, metrics table, world map, weekly traffic, events chart, text block)

---

## Websites

- [x] `/websites` — Websites listing; data table with add-website button; action buttons depend on user/team role

### Website — Traffic Section

- [x] `/websites/[websiteId]` — Overview; metrics bar (views, visitors, visits, bounces, time on site); pageviews/visitors chart with unit selector (hour/day/month/year); panels — Pages (path/URL/entry/exit tabs), Sources (referrers/channels), Environment (browser/OS/device), Location (country/region/city), World Map, Weekly Traffic heatmap; "Show more" opens expanded-view modal
- [x] `/websites/[websiteId]/events` — Events page; metrics bar (visitors, visits, events, unique events); tabbed view: Chart (events chart + event-name table), Activity (events data table), Properties (event properties explorer)
- [x] `/websites/[websiteId]/sessions` — Sessions page; tabbed view: Activity (sessions data table with click-through to session profile), Properties (session properties pivot/chart)
- [x] `/websites/[websiteId]/realtime` — Real-time page; 30-minute sliding window; chart, activity log, paths/referrers panels, countries list, world map; auto-refreshes
- [x] `/websites/[websiteId]/performance` — Web vitals performance page; LCP, FID, CLS and other Core Web Vitals metrics with charts
- [x] `/websites/[websiteId]/compare` — Date comparison page; side-by-side metrics bar and chart for two date ranges; comparison tables for pages/sources/environment/location
- [x] `/websites/[websiteId]/breakdown` — Cross-dimensional breakdown page; configurable multi-field breakdown table; field-selector dialog; CSV download

### Website — Behavior Section

- [x] `/websites/[websiteId]/goals` — Goals report; list of saved goal reports; add-goal button (dialog); each goal card shows completion metrics
- [x] `/websites/[websiteId]/funnels` — Funnels report; list of saved funnel reports; add-funnel button (dialog); each funnel card shows step completion rates
- [x] `/websites/[websiteId]/journeys` — User journeys; configurable path-flow visualization; step-count selector (2–7); start/end step search fields; all/views/events filter
- [x] `/websites/[websiteId]/retention` — Retention cohort analysis; monthly cohort grid; month-picker (no date-range filter, uses month selector)
- [x] `/websites/[websiteId]/replays` — Session replays; tabbed: Replays (filterable table of recorded sessions), Saved (bookmarked replays); behind upgrade gate in cloud mode
- [x] `/websites/[websiteId]/heatmaps` — Click/scroll heatmaps; URL search field; click/scroll mode toggle; embedded iframe heatmap overlay; behind upgrade gate in cloud mode

### Website — Audience Section

- [x] `/websites/[websiteId]/segments` — Segments management; data table of saved audience segments; add/edit/delete segment actions; segment filter builder
- [x] `/websites/[websiteId]/cohorts` — Cohorts management; data table of saved cohorts; add/edit/delete actions; no date filter

### Website — Growth Section

- [x] `/websites/[websiteId]/utm` — UTM parameters report; breakdown tables for source, medium, campaign, content, term
- [x] `/websites/[websiteId]/revenue` — Revenue tracking; revenue stats, chart, metrics by session; requires revenue events with `revenue` property
- [x] `/websites/[websiteId]/attribution` — Attribution report; configurable model (first-click / last-click), type (viewed page / triggered event), conversion step; attribution table

### Website — Settings

- [x] `/websites/[websiteId]/settings` — Website settings page (same component as `/settings/websites/[websiteId]`); sections: Edit form (name, domain), Tracking code (script snippet), Replay settings (enable/configure), Share URL (create/revoke public share), Data (reset/delete website data, transfer ownership)

### Website — Sub-pages

- [x] `/websites/[websiteId]/sessions/[sessionId]` — Session profile (full-page view); session info (device, browser, OS, location), activity timeline, properties, associated replays
- [x] `/websites/[websiteId]/replays/[replayId]` — Replay playback (full-page view); session player with timeline; bookmark/save action; session info panel

---

## Website — Modal/Intercepted Routes

- [x] `/websites/[websiteId]/@modal/(.)sessions/[sessionId]` — Session profile **modal** (parallel route intercept from sessions list row click); same content as full-page session profile but rendered as an overlay drawer
- [x] `/websites/[websiteId]/@modal/(.)replays/[sessionId]` — Replay **modal** (parallel route intercept from replays list row click); replay player in a modal overlay

---

## Website Overview — Expanded View Modal (UI state, not a distinct route)

- [x] `?view=path|fullPath|entry|exit|title|query|referrer|channel|domain|country|region|city|browser|os|device|language|screen|utmSource|utmMedium|utmCampaign|utmContent|utmTerm|event|hostname|distinctId|tag` — Expanded-view modal triggered from "Show more" on overview panels; left nav menu + full paged table for any dimension

---

## Links (Link Tracking)

- [x] `/links` — Links listing; data table; add/edit/delete link actions
- [x] `/links/[linkId]` — Link analytics page; header with link URL; date/filter controls; metrics bar; visitors chart; panels (sources/location/environment/UTM); expanded-view modal available
- [x] `/links/[linkId]/edit` — Link settings page; edit form (name, URL, slug); share URL management (create/revoke)

---

## Pixels (Pixel Tracking)

- [x] `/pixels` — Pixels listing; data table; add/edit/delete pixel actions
- [x] `/pixels/[pixelId]` — Pixel analytics page; same layout as link analytics (header, date/filter controls, metrics bar, chart, panels); expanded-view modal available
- [x] `/pixels/[pixelId]/edit` — Pixel settings page; edit form (name, slug); share URL management

---

## Settings (User-level)

- [x] `/settings` → redirects to `/settings/preferences`
- [x] `/settings/preferences` — Application preferences; default date range, timezone, language, theme (light/dark/system), version info
- [x] `/settings/profile` — Profile settings; change display name, username; change password (dialog)
- [x] `/settings/teams` — Teams list; create team (dialog), join team by access code (dialog); leave team action
- [x] `/settings/teams/[teamId]` — Team settings; team name/access code edit; members table (add/edit role/remove); delete team (team owner only)
- [x] `/settings/websites` — Websites list (team-scoped when in team context); same data table as `/websites`
- [x] `/settings/websites/[websiteId]` — Website settings (standalone settings route); identical to `/websites/[websiteId]/settings`

---

## Teams

- [x] `/teams` — Teams list page (within (main) app shell); create/join team; table of teams with leave/settings actions
- [x] `/teams/[teamId]` → redirects to `/teams/[teamId]/websites`
- [x] `/teams/[teamId]/*` — All main app routes (websites, boards, links, pixels, settings/*) are available under team prefix via Next.js rewrite; team context scopes API calls; dashboard is excluded from team context (redirected)
- [x] `/teams/[teamId]/settings` → redirects to `/teams/[teamId]/settings/preferences`

---

## Admin (self-hosted only; disabled in cloud mode)

- [x] `/admin` → redirects to `/admin/users`
- [x] `/admin/users` — Users management list; create user (dialog); delete user; search/filter; links to individual user pages
- [x] `/admin/users/[userId]` — User detail/settings; edit username, role, password; view user's websites
- [x] `/admin/websites` — All-websites management list (across all users/teams); search; links to website settings
- [x] `/admin/websites/[websiteId]` — Website admin settings; same settings form as user-facing website settings
- [x] `/admin/teams` — All-teams management list; create team; links to team settings
- [x] `/admin/teams/[teamId]` — Team admin settings; same as `/settings/teams/[teamId]` with admin privileges (can add members)

---

## Share (Public, No Authentication)

- [x] `/share/[slug]` — Public shared entity view; entity type auto-detected from share record: website (with nav), board (no nav), link (no nav), pixel (no nav); themed per share parameters; Umami footer
- [x] `/share/[slug]/overview` — Shared website overview (same as `/websites/[websiteId]` without admin actions)
- [x] `/share/[slug]/events` — Shared website events
- [x] `/share/[slug]/sessions` — Shared website sessions
- [x] `/share/[slug]/realtime` — Shared website realtime
- [x] `/share/[slug]/performance` — Shared website performance
- [x] `/share/[slug]/compare` — Shared website compare
- [x] `/share/[slug]/breakdown` — Shared website breakdown
- [x] `/share/[slug]/goals` — Shared website goals (read-only; add-goal button hidden)
- [x] `/share/[slug]/funnels` — Shared website funnels (read-only; add-funnel button hidden)
- [x] `/share/[slug]/journeys` — Shared website journeys
- [x] `/share/[slug]/retention` — Shared website retention
- [x] `/share/[slug]/utm` — Shared website UTM
- [x] `/share/[slug]/revenue` — Shared website revenue
- [x] `/share/[slug]/attribution` — Shared website attribution

---

## Collection Endpoints (Non-UI, HTTP API endpoints)

- [x] `/p/[slug]` — Pixel collection endpoint (GET); returns 1×1 transparent GIF; records pixel impression event; used in email/HTML `<img>` tags
- [x] `/q/[slug]` — Queue collection endpoint (POST); accepts batched analytics events from tracker script

---

## Test Console (Feature-flagged)

- [~] `/console/[websiteId]` — Test console page; renders `null` unless `ENABLE_TEST_CONSOLE=true` environment variable is set; provides a UI to manually send test tracking events to a website

---

## Redirects Summary

| From | To | Note |
|------|----|------|
| `/` | `/websites` or `/teams/:id/websites` | Client-side based on localStorage |
| `/admin` | `/admin/users` | Server redirect |
| `/settings` | `/settings/preferences` | Server redirect |
| `/teams/:id` | `/teams/:id/websites` | Server redirect |
| `/teams/:id/settings` | `/teams/:id/settings/preferences` | Server redirect |
| `/teams/:id/dashboard` | `/dashboard` | Server redirect |
| `/teams/:id/dashboard/edit` | `/dashboard/edit` | Server redirect |
| `/boards/create` | `/boards` | Client-side |
| `/teams/:teamId/*` | `/*` | Server rewrite (team context via URL extraction) |

---

## Key UI Flows

1. **Login → Analytics**: `/login` → credentials → `/websites` → click website → `/websites/[id]`
2. **Add website**: `/websites` → "Add website" button → dialog (name, domain) → save → tracking code panel
3. **View session profile**: `/websites/[id]/sessions` → click row → session profile modal (intercept) or `/sessions/[id]` full page
4. **Watch replay**: `/websites/[id]/replays` → click row → replay modal or `/replays/[id]` full page → bookmark/save
5. **Create funnel**: `/websites/[id]/funnels` → "Add funnel" → dialog (steps) → save → funnel card with conversion rates
6. **Create goal**: `/websites/[id]/goals` → "Add goal" → dialog → save → goal card with completion %
7. **Share website publicly**: `/websites/[id]/settings` → Share section → toggle on → copy URL → public `/share/[slug]`
8. **Create board**: `/boards` → "Add board" button → dialog → board created → `/boards/[id]/design` to configure layout
9. **Create/join team**: `/settings/teams` → "Create team" or "Join team" → `/teams/[id]` context
10. **Admin user management**: `/admin/users` → "Add user" → dialog → set role/password; or click row → `/admin/users/[id]`
11. **Track link clicks**: `/links` → "Add link" → dialog → `/links/[id]` analytics → `/links/[id]/edit` for share
12. **Track pixel impressions**: `/pixels` → "Add pixel" → dialog → `/pixels/[id]` analytics → `/pixels/[id]/edit` for share
13. **Expanded metrics view**: `/websites/[id]` → "Show more" on any metrics panel → expanded view modal with 25+ dimensions
14. **Settings flow**: user avatar/button → `/settings/preferences` → `/settings/profile` → `/settings/teams`

---

## Notes on Special Handling

- **Auth gate**: All `/websites/*`, `/dashboard`, `/boards/*`, `/links/*`, `/pixels/*`, `/settings/*`, `/admin/*`, `/teams/*` routes check auth via `useLoginQuery`; unauthenticated users are redirected to `/login`
- **Admin gate**: `/admin/*` routes check `cloudMode` env and render `null` in cloud deployments
- **Subscription gate**: `/websites/[id]/replays` and `/websites/[id]/heatmaps` show upgrade prompt in cloud mode without the `replays` feature flag
- **Test console gate**: `/console/[websiteId]` requires `ENABLE_TEST_CONSOLE=true` env
- **Team role-based access**: Add/edit/delete actions on websites, team settings, etc. are conditionally rendered based on `teamOwner`, `teamManager`, `teamMember`, `teamViewOnly`, `viewOnly` roles
- **Dynamic content**: All website report pages require actual tracking data for meaningful output; the seed instance has 0 sessions/events so report pages render empty states
- **Share pages**: `/share/[slug]/*` sub-pages are only accessible if the owner explicitly enabled them in share settings (`parameters[page] === true`); unauthorized sub-paths redirect to `/share/[slug]`
- **Modal intercepts**: Next.js parallel routes (`@modal`) intercept navigation to `/sessions/[id]` and `/replays/[id]` from within the website context, showing them as modals instead of full pages; direct URL access still works as full pages
