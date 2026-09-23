# Implementation Plan — Prompt 8: Admin Panel and Final Application Polish

Status: Awaiting approval. Planning only; no implementation changes made for Prompt 8.

## Foundation and scope

Read root gemini.md and brandguidelines.md and inspected the Prompt 7 admin APIs, current role guard, page inventory and CSR budget presentation. Prompt 7 is complete: 91 backend tests, five browser suites and the production build passed. Preserve its secured review services, private evidence storage, notifications and all Prompt 1–7 workflows. Keep the current approved teal/terracotta/off-white palette and existing technology stack. No new charting dependency, payment integration, dynamic category collection or public admin signup.

The existing frontend has an admin dashboard placeholder and a role guard that renders an access-restricted view. The existing verification endpoint lists only pending profiles; report lists do not include full target previews; project evidence review has a mutation endpoint but no queue endpoint. Add these missing read APIs rather than fetching through another role's restricted dashboard endpoints. The previous completed plan is superseded; its decisions remain in gemini.md.

## 1. Admin bootstrap and additional accounts

- Add server/scripts/createAdmin.js, runnable from repository root with `node server/scripts/createAdmin.js`. Load server/.env, with shell variables taking precedence. Require ADMIN_EMAIL and ADMIN_PASSWORD; validate email and the existing password requirements, hash with bcrypt, set role=admin and isEmailVerified=true. Do not print passwords, hashes or connection secrets.
- Connect to the configured persistent database, refusing an ephemeral fallback. If any admin already exists, exit with a clear no-op message. Never promote or overwrite an existing non-admin with a matching email. Preserve all existing users and demo data.
- Protect simultaneous bootstrap runs with a database-enforced unique bootstrap guard on User; test separate invocations and conflicting credentials. Do not rely solely on a find-then-insert check.
- Add POST /api/admin/create-admin behind the existing authenticate/authorize('admin') middleware. Use an allowlisted name/email/password payload, validation, hashing and duplicate-email handling. New admins are verified; no credentials return in responses. Provide this form within the admin user-management section.
- Document the script and environment variables in README/.env.example using empty placeholders. Do not invent credentials or create an account in the user's database without supplied credentials. Public signup must continue rejecting role=admin, including forged API requests.

## 2. Suspension and user management APIs

- Add User.isSuspended with default false; existing absent values remain active. Keep role, suspension, password hash and verification fields server-controlled.
- GET /api/admin/users: bounded pagination, validated role filter, escaped name/email search, newest first, safe fields only. Include existing role-profile summary fields without recomputing NGO/CSR historical totals.
- GET /api/admin/users/:id: safe account details and the correct role-specific profile. Internal organization review notes/evidence remain available only to authorized admin responses; exclude auth secrets and refresh tokens.
- PATCH /api/admin/users/:id/suspend and /reactivate: idempotent state transitions. Suspension revokes refresh sessions and is checked by login, refresh and authenticated request middleware so existing access tokens cannot bypass it. Reactivation permits a fresh login and does not revive revoked sessions.
- Prevent self-suspension and suspension of the last active admin, including concurrent requests, to avoid locking out administration. Preserve normal login failure behavior and show a clear suspended-account message after valid credentials are established.

## 3. Accurate platform statistics and categories

GET /api/admin/stats/overview aggregates the database rather than fixture values:

- User totals by role and suspension state; Problem and Project totals by status.
- NGO/CSR verification totals including verified, pending and rejected.
- Active CSR Funding allocations (exclude withdrawn); separately show confirmed volunteer donations and combined simulated funding, avoiding double counting Project.fundingReceived.
- Volunteer hours from confirmed structured time/skills contributions, counted once per session; do not add project mirrors or ImpactRecord snapshots to these totals. Clearly distinguish any retained legacy/manual values rather than silently treating them as structured contributions.
- Completed project count from Project status; beneficiaries reached from structured completion ImpactRecords, excluding placeholder metric rows. Display the snapshot basis clearly.
- Pending verification/report counts for quick links.

GET /api/admin/stats/growth returns the last 12 weekly or monthly periods for new Users and Projects. Validate the interval, use documented UTC boundaries (Monday for weeks), and fill empty periods with zero. Use a small accessible chart/table component based on existing presentation patterns; no library addition.

GET /api/admin/categories derives its list from PROBLEM_CATEGORIES and returns separate Problem/Project usage counts plus their combined count. Preserve the enum as the schema validation source. Explain that combined counts count documents, including an adopted Problem and its linked Project separately. Add the future enum-to-reference migration note in code and an accessible disabled Add Category control with explanatory text/tooltip in the UI.

## 4. Complete the admin read/review contracts

Reuse Prompt 7 review, reporting, evidence-download and notification services.

- Keep GET /api/admin/verifications/pending compatible; add GET /api/admin/verifications with a validated pending/verified/rejected filter and pagination for history tabs. History shows current status and existing last-review metadata; do not invent an audit trail the schema does not store.
- Require nonempty notes for approve/reject actions on both frontend and API; keep private notes out of organization/public responses. Ensure resulting notifications and current badges refresh in all relevant views.
- Add GET /api/admin/reports/:id with safe reporter details and a typed inline target preview fetched from the correct collection. Represent a deleted target explicitly. Never expose password/token fields when the target is a User. Existing report lists remain filterable and pending-first; existing review mutation handles notes and optional supported flagging.
- Add GET /api/admin/projects/pending-verification with pagination for requiresAuthorityApproval=true and evidenceVerified=false, including before/after photos, project budget and managing NGO summary. Reuse the existing verify-evidence mutation; make missing evidence clear and disable the action until prerequisites exist.
- All additions live under the existing admin-only router. Verify 401 without authentication and 403 for each non-admin role, including unknown admin child paths.

## 5. Admin frontend and reusable components

Replace the placeholder with an admin-only nested layout under /admin/*, with distinct sidebar/control-panel organization while sharing the existing brand tokens. Use a compact accessible menu on mobile. Build:

1. /admin/dashboard — overview cards, 12-period growth chart/table and counted quick links.
2. /admin/verifications — status tabs, organization summaries, authenticated evidence downloads and approve/reject forms with required notes.
3. /admin/reports — filters, expandable inline target/reporter context, review notes, status actions and supported flagging.
4. /admin/users — search/filter/pagination, role summaries, detail view, confirmed suspend/reactivate actions and admin-account creation form. Add /admin/users/:id for directly addressable details if useful.
5. /admin/categories — enum usage overview and explained disabled Add Category control.
6. /admin/project-verification — evidence queue, before/after review and confirmation feedback.

Reusable components: AdminStatCard, AdminNavSidebar, VerificationReviewCard, ReportReviewCard, UserTableRow and SimpleGrowthChart. User/category tables become readable cards at small widths. Private documents use authenticated blob downloads, not unprotected browser links. Admin report notifications should link to the new report review area.

Guard the entire /admin/* subtree, including unmatched child paths. Non-admin navigation renders an explicit 403 Forbidden screen without mounting admin content or fetching its data. Because this is a client-rendered Vite SPA, the document request itself remains an HTML response; actual API access returns HTTP 403. Do not claim that a React route can independently change the hosting server's HTTP status.

## 6. Full-application polish audit

Create a reviewable audit checklist in docs/prompt8-polish-audit.md covering each active routed page, its role, 375px layout, loading/empty/error/retry behavior, forms/feedback, keyboard/labels and verification result. Inventory routes from App.jsx, not filenames alone, so aliases/shared dashboards are covered without polishing unused placeholder files.

Audit and fix these areas:

- Public/auth pages: landing, signup, login, email verification, forgot/reset password; input labels, validation errors, submission feedback, focus and keyboard behavior.
- Community: dashboard, Discover, Problem detail/post, Project detail, My Applications, Saved, profile and My Impact.
- NGO: dashboard/discovery, My Projects, create/detail/edit, applicant review, resources/photos, team access, profile/evidence uploads.
- CSR: dashboard/discovery, project evaluation, portfolio, monitor, reports, budget and company profile/evidence uploads.
- Shared: Team Workspace, notifications, Impact Stories/list, contribution/funding/report dialogs, navbar/footer, role guards and all new admin pages.

For every list/grid, use a clear loading indicator/skeleton, the existing EmptyState only after a successful empty response, and a visible error with a working Retry button. Reset pagination appropriately after filters; prevent stale responses and distinguish empty filtered results from failures. Keep already loaded data visible during background polling where appropriate.

Review every form for associated labels, required/invalid feedback, disabled busy states, success confirmation and error recovery. Preserve entered data on failures. Ensure modal keyboard focus, Escape and return focus behavior, meaningful image alt text and accessible names for icon buttons.

Use shared StatusBadge, UrgencyBadge, VerificationBadge and status-pipeline semantics consistently; replace drifted local representations rather than changing brandguidelines.md. Check button/badge text contrast and adjust shades within the approved palette if needed. Preserve typography/layout except concrete usability fixes. Correct stale build-stage text and inaccurate currency copy in shared UI where found.

Verify role navigation against existing routes. Admin users get admin navigation; community, NGO and CSR users retain their own flows. Keep shared notifications and impact navigation usable on mobile. Fix actual overflow sources rather than hiding horizontal overflow globally.

## 7. Verification and regression gates

Use isolated MongoDB replica sets and temporary browser profiles. Do not seed, suspend or otherwise mutate the user's live accounts for testing.

Backend tests:

- Bootstrap first run, repeat run, concurrent runs, invalid/missing credentials, existing-admin no-op and non-admin email collision. Test admin creation endpoint authorization and ensure public signup rejects admin.
- Spot-check at least three overview figures against fixture records and independent raw database calculations; also cover withdrawn funding, pending contributions, distinct hours, completed snapshots and zero-filled growth boundaries.
- Exercise history filters, report target previews for all five target types, deleted targets, evidence queue, required review notes and categories/counts.
- Suspension blocks login, token refresh and an already-issued access token; reactivation restores login. Test self/last-admin protection and concurrency.
- Retest all existing Prompt 1–7 backend suites and authorization boundaries.

Browser checks:

- Real admin login, all six pages, account detail/creation, review documents, approve/reject and cross-session badge updates, report context/actions, evidence review and suspension/reactivation.
- Directly visit every /admin route as each non-admin role and assert the 403 view with no admin content leakage.
- Exercise each routed list/grid with delayed requests, genuinely empty data and injected server failures followed by successful Retry. Record results in the polish audit.
- Test all four dashboards and key pages at 375px; inspect screenshots for overlap and horizontal overflow. Keyboard-check navigation, dialogs, labels and action feedback; calculate contrast for shared token/badge combinations.
- Explicitly rerun signup/login for community/NGO/CSR, posting, adoption, CSR allocation, team messaging, all contribution forms, completion and notifications. Reuse and extend the five existing browser suites rather than replacing them with only admin tests.
- Run production frontend build and review the final diff for unintended data, authentication or branding changes.

## 8. Completion documentation

After implementation and required checks pass, update README with admin setup, endpoint contracts, aggregate definitions and operating instructions. Mark Prompt 8 complete in gemini.md, retain prior build history, and add a developer-oriented Application Summary covering the three participant roles plus administrators, Discover → Match → Contribute → Track Impact, auth/role security, matching/teams, simulated finance and impact, private verification/reporting, notifications, stack and local database requirements. Document remaining scope boundaries honestly: simulated payments, polling, enum categories, and current-status verification history.

Do not mark all eight prompts complete until the implementation and verification work is finished.
