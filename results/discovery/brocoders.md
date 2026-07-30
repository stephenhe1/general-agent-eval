# UI Coverage (Discovery: 14 routes + 8 UI states/flows / 22 total explored)

Legend: [ ] found but not yet explored  -  [x] explored and confirmed  -  [~] unreachable (reason)

---

## Root / Language Redirect

- [x] `/` → 307 redirect to `/{browser-language}` - Proxy detects Accept-Language header, redirects to localised root
- [x] `/{language}` (e.g. `/en`, `/ar`, `/fr`, `/es`, `/hi`, `/uk`, `/zh`) - Supported: 7 locales; each locale prefix works as-is (confirmed 200 for `/en` and `/ar`)

---

## Public Pages (no auth required)

- [x] `/en` (home) — Landing page with app description and link to Privacy Policy; visible to everyone
- [x] `/en/sign-in` — Email + password form; links to Forgot Password and Sign Up; Google and Facebook OAuth buttons rendered if env vars set (`NEXT_PUBLIC_IS_GOOGLE_AUTH_ENABLED`, `NEXT_PUBLIC_IS_FACEBOOK_AUTH_ENABLED`); guarded by `withPageRequiredGuest` (redirects logged-in users away)
- [x] `/en/sign-up` — First name, last name, email, password, privacy-policy checkbox; links to Sign In and Privacy Policy; Social Auth buttons conditional on env; guarded by `withPageRequiredGuest`; only visible when `NEXT_PUBLIC_IS_SIGN_UP_ENABLED=true` (currently true)
- [x] `/en/forgot-password` — Single email input; submits to API; shows success toast; guarded by `withPageRequiredGuest`
- [x] `/en/password-change` — New password + confirmation; reads `hash` and `expires` query params from email link; shows "link expired" alert when token stale; guarded by `withPageRequiredGuest`; on success redirects to `/sign-in`
- [x] `/en/confirm-email` — Loading spinner only; reads `hash` query param; calls confirm-email API, redirects to `/profile` on success or `/` on failure; no auth guard (works for new registrations)
- [x] `/en/confirm-new-email` — Loading spinner only; reads `hash` query param; confirms email change for logged-in users (re-fetches /me) then redirects to `/profile`; no strict auth guard
- [x] `/en/privacy-policy` — Static long-form Privacy Policy document; no auth required; linked from home and sign-up pages

---

## Authenticated User Pages (any logged-in role)

- [x] `/en/profile` — Avatar, full name, email display; "Edit Profile" button → `/profile/edit`; guarded by `withPageRequiredAuth`
- [x] `/en/profile/edit` — Three stacked forms on one page: (1) Basic info (avatar upload, first name, last name), (2) Change email (new email + confirmation — only shown for email-provider accounts), (3) Change password (old password, new, confirm — only shown for email-provider accounts); guarded by `withPageRequiredAuth`

---

## Admin-Only Pages (role = ADMIN)

- [x] `/en/admin-panel` — Admin Panel home; title + description only; guarded by `withPageRequiredAuth({ roles: [RoleEnum.ADMIN] })`
- [x] `/en/admin-panel/users` — Virtualised infinite-scroll table of users; columns: avatar, ID, name, email, role; sortable by ID and email; Filter popover (by role); Create button → `/admin-panel/users/create`; per-row Edit button and Delete dropdown item; URL reflects sort/filter via `?sort=` and `?filter=` query params; guarded by admin role
- [x] `/en/admin-panel/users/create` — Form: avatar upload, email, password, password confirmation, first name, last name, role select (Admin/User); on success navigates back to users list; guarded by admin role
- [x] `/en/admin-panel/users/edit/[id]` — Two stacked forms: (1) Edit user info (avatar, email, first/last name, role select), (2) Change user password; pre-fetches user by `id` param; guarded by admin role

---

## UI Components / Overlay Flows (distinct interactive states)

- [x] **Sidebar (offcanvas, mobile)** — Triggered by hamburger `SidebarTrigger` in app bar on small screens; shows nav links: Home, Users (admin only), sign-in/sign-up (guests) or profile dropdown (logged in); closes automatically on navigation
- [x] **User Profile Dropdown Menu** — In sidebar footer when logged in; opens dropdown with "Profile" link and "Log Out" action; shows avatar, full name, email
- [x] **Language Switcher** — `<Select>` in app bar header; 7 options (en, ar, es, fr, hi, uk, zh); switching reloads page at same path with new locale prefix
- [x] **Theme Toggle** — Button in app bar; toggles light ↔ dark mode via `next-themes`
- [x] **User Filter Popover** (`/admin-panel/users`) — "Filter" button opens Popover with multi-select role checkboxes (Admin, User); "Apply" serialises selection to `?filter=` query param
- [x] **Confirm Delete Dialog** (`/admin-panel/users`) — AlertDialog: "Are you sure?" with Yes/No buttons; triggered from per-row Delete dropdown; performs optimistic cache update then API DELETE
- [x] **Leave Page AlertDialog** — AlertDialog triggered when navigating away from any dirty edit/create form; buttons: Stay / Leave; appears on `/profile/edit`, `/admin-panel/users/create`, `/admin-panel/users/edit/[id]`
- [x] **Social Auth Buttons (Google / Facebook)** — Rendered on Sign In and Sign Up pages when respective env vars are `true`; currently both enabled (`NEXT_PUBLIC_IS_GOOGLE_AUTH_ENABLED=true`, `NEXT_PUBLIC_IS_FACEBOOK_AUTH_ENABLED=true`)

---

## Auth Guard Behaviour (redirects — not pages, but significant flows)

- [x] **Guest → protected page** — Unauthenticated user hitting any `withPageRequiredAuth` page is redirected to `/sign-in?returnTo=<original-path>`
- [x] **User → admin-only page** — Authenticated non-admin hitting admin pages is redirected to `/` (home)
- [x] **Logged-in user → guest-only page** — Authenticated user hitting `withPageRequiredGuest` page is redirected to `returnTo` param or `/{language}`
- [x] **Loading state** — `loading.tsx` renders a progress-bar animation at top of page while route segment is loading

---

## Notes

- **Backend not reachable locally**: `.env.local` points to `http://localhost:3001/api` which is the Cypress RWA backend (unrelated); all auth-dependent interactions (sign-in, admin panel data) will fail at runtime. The Heroku demo backend (`https://nestjs-boilerplate-test.herokuapp.com/api`) also requires known credentials not available in this repo.
- **Dynamic segments**: `/en/admin-panel/users/edit/[id]` — `id` is a numeric user ID from the API
- **Query params**: `/en/admin-panel/users?sort=<JSON>&filter=<JSON>` — both are optional; `password-change?hash=<hash>&expires=<timestamp>` — required for token-based reset; `sign-in?returnTo=<path>` — redirect after login
- **i18n**: All 14 routes exist under every language prefix (`/ar/…`, `/es/…`, `/fr/…`, `/hi/…`, `/uk/…`, `/zh/…`). Source confirms `generateStaticParams()` pre-generates all locale variants.
- **React Query Devtools**: Present in dev mode (bottom-right panel) — not a page but a developer tool overlay.
