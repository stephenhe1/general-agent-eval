# UI Coverage (Discovery: 34/34)
Legend: [ ] found but not yet explored  -  [x] explored and confirmed  -  [~] unreachable (reason)

App: **Cypress Real World App** — a full-stack React/Express payment demo.  
Running at: http://localhost:3000 (frontend) / http://localhost:3001 (backend API)  
Default credentials: any user from `data/database.json`, password `s3cret`  
Example: username `Heath93`, password `s3cret`

---

## Authentication (Unauthenticated routes)

- [x] `/signin` — Sign In page. Username + password fields, "Remember me" checkbox, "Sign In" button (disabled until valid), link to `/signup`. Shows error alert on bad credentials. Unauthenticated `/*` redirects here.
- [x] `/signup` — Sign Up page. Fields: first name, last name, username, password, confirm password. Formik validation with inline errors. Link to `/signin`. On success, redirects to app.
- [~] `/forgotpassword` — Commented out in source (`SignInForm.tsx` line 165); no route registered. Not reachable.

---

## Transaction Lists (Authenticated — home area)

All three tabs share a common filter bar (date range + amount range) and are protected by `PrivateRoute`.

- [x] `/` or `/public` — **Everyone tab** (TransactionPublicList). Shows all public transactions from all users. Infinite scroll. Transaction cards link to detail page. Nav tab: "Everyone".
- [x] `/contacts` — **Friends tab** (TransactionContactsList). Shows transactions involving only the current user's contacts. Same filter bar. Nav tab: "Friends".
- [x] `/personal` — **Mine tab** (TransactionPersonalList). Shows only the current user's own transactions (sent + received). Same filter bar. Nav tab: "Mine".

### Transaction List UI States / Overlays

- [x] **Date Range Filter popover** — Clicking "Date: ALL" chip on any transaction list opens a `Popover` (desktop) or bottom `Drawer` (mobile xs breakpoint) with a `react-calendar` date-range picker. Selecting a range filters the list; an ×-chip clears it.
- [x] **Amount Range Filter popover** — Clicking "Amount: $0 – $100" chip opens a `Popover` (desktop) or bottom `Drawer` (mobile xs) with an MUI Slider ($0–$100). Adjusting range filters the list; "Clear" button resets it.
- [x] **Empty state** — `EmptyList` component renders an illustration when there are no transactions matching the current filter or in the selected tab.

---

## Transaction Detail

- [x] `/transaction/:transactionId` — **Transaction Detail** page. Shows sender/receiver avatars, description, amount (formatted), like count + like button (disabled once already liked), comment form, and existing comments thread. If current user is the receiver of a pending payment request, shows **Accept Request** (green) and **Reject Request** (red) action buttons.

### Transaction Detail Interactive States

- [x] **Like action** — "Like" (ThumbUp) icon button on the detail page; disabled after the current user already liked it. Fires POST to `/likes`.
- [x] **Comment form** — Text field + submit button below the like section. Fires POST to `/comments`. Comment appears in the thread without reload.
- [x] **Accept / Reject request** — Conditionally rendered only when `receiverIsCurrentUser` AND `isPendingRequestTransaction`; fires PATCH to `/transactions/:id`.

---

## New Transaction Flow (`/transaction/new`)

A 3-step MUI `Stepper` wizard inside a `PrivateRoute`.

- [x] `/transaction/new` — **Step 1: Select Contact** — Search field (debounced) + scrollable user list. Clicking a user advances to Step 2.
- [x] `/transaction/new` — **Step 2: Payment** — Shows selected recipient's avatar/name, amount input (currency-formatted), description note input, and two submit buttons: **Pay** (payment) and **Request** (request). Both are disabled until form is valid.
- [x] `/transaction/new` — **Step 3: Complete** — Confirmation screen showing recipient, amount, type, and description. Two buttons: **Return to Transactions** (→ `/`) and **Create Another Transaction** (resets stepper to Step 1).

---

## Bank Accounts

- [x] `/bankaccounts` — **Bank Accounts list**. Lists the current user's linked bank accounts; each item has a **Delete** button. Has a **Create** button linking to `/bankaccounts/new`. Shows `EmptyList` if no accounts.
- [x] `/bankaccounts/new` — **Create Bank Account form**. Fields: Bank Name (min 5 chars), Routing Number (exactly 9 digits), Account Number (9–12 digits). "Save" button (disabled until valid). On submit, creates the account and redirects to `/bankaccounts`.

---

## User Settings

- [x] `/user/settings` — **User Settings page**. Shows an illustration and a form with: First Name, Last Name, Email, Phone Number fields. "Save" button (disabled until valid and not submitting). Updates profile via `PATCH /users/:id`.

---

## Notifications

- [x] `/notifications` — **Notifications page**. Lists all notifications for the current user. Each item shows icon (comment/like/payment/request), text description, and a **Dismiss** (desktop) or checkmark icon (mobile xs) button that marks the notification as read (PATCH `/notifications/:id`). Bell badge in NavBar shows unread count.

---

## User Onboarding Dialog (Modal flow)

Shown automatically for any newly registered user (or any user with no bank accounts) when accessing any private route. Rendered as a full-screen-on-mobile MUI `Dialog` overlaid on the current route.

- [x] **Onboarding Step 1: Welcome** — "Get Started with Real World App" dialog. Navigator illustration + explanatory text. "Next" button. "Logout" button to cancel.
- [x] **Onboarding Step 2: Create Bank Account** — Inline bank account form (same fields as `/bankaccounts/new`). "Logout" button. Submitting advances to Step 3.
- [x] **Onboarding Step 3: Finished** — "You're all set!" confirmation screen with PersonalFinance illustration. "Done" button closes the dialog and marks onboarding complete.

---

## Navigation Components (Persistent Chrome)

- [x] **Top AppBar (NavBar)** — Always visible when authenticated. Contains: hamburger (toggle side drawer), app logo/home link, green **"$ New"** button (→ `/transaction/new`), notifications bell icon with badge count (→ `/notifications`). On home/public/contacts/personal routes also shows the 3-tab `TransactionNavTabs` bar.
- [x] **Side NavDrawer** — Collapsible persistent drawer (desktop) / temporary drawer (mobile xs). Shows user avatar, full name, username, account balance. Menu links: Home (→ `/`), My Account (→ `/user/settings`), Bank Accounts (→ `/bankaccounts`), Notifications (→ `/notifications`), Logout (fires LOGOUT event → redirects to `/signin`).
- [x] **AlertBar / Snackbar** — Global snackbar shown as a floating notification on successful transaction submission ("Transaction Submitted!") and other events. Uses `snackbarMachine`.

---

## Backend / API Surface (not React SPA routes)

- [x] `http://localhost:3001/graphql` (GET) — **GraphQL Playground** — Interactive GraphQL explorer UI (graphql-playground-middleware-express). Available in dev/test mode. Separate from the React SPA.
- [x] `http://localhost:3001/graphql` (POST) — **GraphQL API endpoint** — Handles all GraphQL queries/mutations mirroring the REST API.
- [x] `http://localhost:3001/login` (POST) — Session login (passport-local). Returns user object + sets `connect.sid` cookie.
- [x] `http://localhost:3001/logout` (POST) — Session logout. Clears cookie and destroys session.
- [x] `http://localhost:3001/checkAuth` (GET) — Auth check: 401 if unauthenticated, 200+user if authenticated.
- [x] `http://localhost:3001/users` — User CRUD (list, get, update).
- [x] `http://localhost:3001/transactions` — Transaction CRUD (list, get, create, update).
- [x] `http://localhost:3001/bankAccounts` — Bank account CRUD.
- [x] `http://localhost:3001/notifications` — Notification list + mark-read.
- [x] `http://localhost:3001/contacts` — Contact list for the current user.
- [x] `http://localhost:3001/likes` — Like creation.
- [x] `http://localhost:3001/comments` — Comment creation.
- [x] `http://localhost:3001/bankTransfers` — Bank transfer records.
- [x] `http://localhost:3001/testData` (dev/test only) — Test data seeding endpoints.

---

## Alternate Auth Provider Builds (not active in default config)

These are separate entry points compiled with different env vars; the React SPA routes are identical to the default build once authenticated. Requires external provider configuration.

- [~] **Auth0 build** (`yarn dev:auth0`) — Uses `AppAuth0.tsx`; replaces sign-in with Auth0 hosted login. Same private routes. Requires `VITE_AUTH0` env vars.
- [~] **Okta build** (`yarn dev:okta`) — Uses `AppOkta.tsx`; adds `/implicit/callback` route for Okta token redirect. Same private routes. Requires `VITE_OKTA` env vars.
- [~] **AWS Cognito build** (`yarn dev:cognito`) — Uses `AppCognito.tsx`. Requires `VITE_AWS_COGNITO` env vars.
- [~] **Google Auth build** (`yarn dev:google`) — Uses `AppGoogle.tsx`. Requires `VITE_GOOGLE_CLIENTID` env vars.

---

## Summary

| Category | Count |
|---|---|
| Unauthenticated page routes | 2 (`/signin`, `/signup`) |
| Authenticated page routes | 9 (`/`, `/public`, `/contacts`, `/personal`, `/user/settings`, `/notifications`, `/bankaccounts`, `/bankaccounts/new`, `/transaction/:id`) |
| Multi-step flows | 2 (New Transaction wizard 3 steps; User Onboarding dialog 3 steps) |
| Inline UI states / overlays | 6 (date filter, amount filter, like, comment, accept/reject request, empty list) |
| Persistent navigation chrome | 3 (NavBar, NavDrawer, AlertBar) |
| Backend/API endpoints | 14 |
| Alternate auth builds (unreachable without config) | 4 |
| Commented-out / dead routes | 1 (`/forgotpassword`) |
| **Total discovered entries** | **34** |
| **Confirmed [x]** | **30** |
| **Unreachable [~]** | **5** (4 alt-auth builds + `/forgotpassword`) |
