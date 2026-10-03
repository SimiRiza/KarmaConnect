# KarmaConnect

## Production setup

See [production configuration and deployment responsibilities](docs/production-readiness.md)
before deploying. Production requires validated secrets, SMTP, persistent MongoDB
and explicit durable upload directories. Routing, HTTPS and storage mounts remain
your existing host's configuration; the application does not deploy itself.

## Fictional presentation data

This workspace's local database uses `127.0.0.1:27018`, replica set
`karmaLocal`, with persistent files in `.local/mongodb` (excluded from Git).
Restart the application after changing `server/.env`. MongoDB is currently
started manually; after reboot, start it again from the repository root in
PowerShell before starting the app:

```powershell
& "$env:USERPROFILE/.cache/mongodb-binaries/mongod-x64-win32-7.0.24.exe" --dbpath "$PWD/.local/mongodb" --port 27018 --bind_ip 127.0.0.1 --replSet karmaLocal --logpath "$PWD/.local/mongodb/mongod.log" --logappend
```

Keep that terminal running. The existing database and demo records survive
restarts; re-seeding is unnecessary unless you want to reset the demo.

From the repository root, after installing dependencies:

```bash
node server/scripts/seedDemoData.js
```

Configure `server/.env` with `USE_IN_MEMORY_DB=false` and `MONGODB_URI`
pointing to the same persistent MongoDB replica set (or Atlas database) used
by the application. Shell environment variables take precedence; root `.env`
is a fallback. The script deliberately refuses ephemeral databases and requires
transactions, so a failed run cannot leave a partially replaced demo.

This creates 8 verified community accounts, 3 verified NGO accounts, 3 verified
CSR accounts, 8 problems, 6 projects, teams, applications, contributions,
simulated funding and 2 completed Impact Stories. All identities and outcomes
are fictional. Login emails and the shared password **`Demo@1234`** are printed
after a successful run. Emails follow `volunteer1`–`volunteer8`, `ngo1`–`ngo3`
and `csr1`–`csr3` at `demo.karmaconnect.test`.

Re-running replaces only documents with `isSeedData: true` across the eleven
demo models. Existing untagged accounts and records are preserved; an email
collision aborts the entire operation. Tags are stored directly in MongoDB
within the transaction, without changing the existing strict schemas.
Records subsequently created through the app are untagged and will remain
after cleanup, even if they refer to demo users or projects.

To remove tagged demo records without creating replacements:

```bash
node server/scripts/seedDemoData.js --clear
```

For a walkthrough, use `ngo2` for lake-cleanup applications and the completed
water camp, `ngo3` for elderly-care tasks and the completed hall repair, and
`ngo1` for the unfunded computer lab and partially funded digital classes.
CSR accounts 1, 2 and 3 respectively demonstrate education, environmental/
community projects and elderly care. NGO track records and CSR totals are
derived from these projects; no unsupported historical totals are added.
CSR budget strings and focus labels retain the requested presentation values;
the current matching engine may not recognise every descriptive label or
rupee-formatted budget. Placeholder photos require internet access.

> **From local problems to real impact — together.**

KarmaConnect is a community-impact platform that connects local community problems with certified NGOs, passionate volunteers, and CSR-funded companies. The core flow is:
**Discover → Match → Contribute → Track Impact**

This repository contains **Prompt 1 of an 8-part build**, delivering the complete foundation, Mongoose database models, and production-quality authentication system.

---

## Architecture & Tech Stack

- **Frontend (`client/`)**:
  - React 18 (Vite)
  - React Router v6
  - Tailwind CSS with customized brand theme (Teal/Green `#0d9488`, Warm Coral `#f97316`, Warm Off-White `#faf9f6`)
  - React Context API (`AuthContext`) for in-memory access token & session management
  - Axios with automated 401 token refresh queue interceptor
  - Lucide React icons

- **Backend (`server/`)**:
  - Node.js & Express.js (ES Modules)
  - MongoDB with Mongoose ODM
  - Authentication: JWT access tokens (15-min in-memory) + httpOnly, sameSite, secure refresh token cookies (7-day)
  - Passwords hashed with bcrypt (12 salt rounds)
  - Nodemailer for email verification & password reset with development console fallback
  - Input validation via `express-validator` on all authentication endpoints
  - Security hardening: Helmet, CORS, NoSQL injection sanitization (`express-mongo-sanitize`), and rate limiting (`express-rate-limit`)

- **Database Schemas**:
  - `User`: Base user model with geospatial 2dsphere index for location proximity queries
  - `CommunityUserProfile`: One-to-one linked profile for volunteers, students, and professionals
  - `NGOProfile`: One-to-one linked profile for grassroots non-profits
  - `CSRProfile`: One-to-one linked profile for corporate CSR sponsors
  - Placeholders ready for Prompts 2–7: `Problem`, `Project`, `Team`, `Contribution`, `ImpactRecord`, `Notification`

---

## Directory Structure

```
karmaconnect/
├── client/                     # React (Vite) frontend application
│   ├── src/
│   │   ├── components/         # Navbar, Footer, ProtectedRoute, RoleProtectedRoute
│   │   ├── pages/              # Landing, Signup, Login, VerifyEmail, Forgot/Reset, Dashboards
│   │   ├── context/            # AuthContext (React Context API)
│   │   ├── services/           # Axios instance (api.js) & authService.js
│   │   ├── hooks/              # useAuth hook
│   │   ├── index.css           # Tailwind design tokens
│   │   └── App.jsx             # React Router v6 route configuration
│   ├── tailwind.config.js
│   ├── vite.config.js          # API proxy to backend
│   └── package.json
├── server/                     # Express.js backend API
│   ├── config/                 # db.js (MongoDB connection + in-memory fallback)
│   ├── controllers/            # authController.js (JSDoc documented endpoints)
│   ├── middleware/             # auth.js, errorHandler.js, rateLimiter.js, validators.js
│   ├── models/                 # User, CommunityUserProfile, NGOProfile, CSRProfile, etc.
│   ├── routes/                 # authRoutes.js (/api/auth)
│   ├── services/               # authService.js (atomic multi-document transactions)
│   ├── utils/                  # tokenUtils.js, emailService.js, transactionHelper.js
│   └── server.js               # Express application entrypoint
├── .env.example                # Documented configuration variables
├── package.json                # Monorepo runner scripts
└── README.md
```

---

## Quick Start (Run with One Command)

### 1. Prerequisites
- Node.js (v18+)
- npm (v9+)
- (Optional) MongoDB local service or MongoDB Atlas URI (If not available, in-memory MongoDB will automatically activate for local development when `USE_IN_MEMORY_DB=true`).

### 2. Install All Dependencies
Install root, server, and client dependencies with a single command:
```bash
npm run install:all
```
*(Or navigate to root, `server/`, and `client/` and run `npm install` in each)*

### 3. Configure Environment Variables
Copy `.env.example` to `server/.env`:
```bash
# Server configuration
cp .env.example server/.env
```

Review the variables in `server/.env`:
| Variable | Description | Default (Dev) |
|---|---|---|
| `PORT` | Backend server port | `5000` |
| `NODE_ENV` | Application environment | `development` |
| `CLIENT_URL` | Frontend origin for CORS and email links | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/karmaconnect` |
| `USE_IN_MEMORY_DB` | Fallback to in-memory DB if local mongo not running | `true` |
| `JWT_SECRET` | 32+ char random secret for 15-min access tokens | Blank uses a development-only fallback |
| `JWT_REFRESH_SECRET` | Different 32+ char random secret for 7-day refresh tokens | Blank uses a development-only fallback |
| `REQUIRE_EMAIL_VERIFICATION` | Require email verification before login | `false` (for dev) / `true` |
| `SMTP_HOST` | SMTP server host (required in production) | Blank uses development console delivery |
| `EMAIL_FROM` | Outgoing sender display and address (required in production) | Blank uses the development sender |

### 4. Run Both Backend and Frontend Concurrently
From the root directory:
```bash
npm run dev
```

This starts:
- **Server API**: `http://localhost:5000` (Health check: `http://localhost:5000/api/health`)
- **Client App**: `http://localhost:5173`

---

## Authentication & Security Details

1. **In-Memory Access Token**:
   The JWT access token is stored strictly in JavaScript React Context memory (not in `localStorage` or `sessionStorage`), protecting against Cross-Site Scripting (XSS) attacks.

2. **HttpOnly Refresh Token Cookie**:
   The long-lived refresh token is stored in an `httpOnly`, `sameSite`, `secure` (in production) cookie named `refreshToken`. It cannot be read or stolen by clientside JavaScript.

3. **Silent Session Restoration**:
   When the user refreshes the browser, `AuthContext` makes a background call to `/api/auth/refresh`. The browser sends the httpOnly cookie, and the server returns a new access token and user payload without logging the user out.

4. **Automatic Request Retry Interceptor**:
   If an API call returns a `401 Unauthorized` with `TOKEN_EXPIRED`, the Axios interceptor requests a fresh token and replays the original request transparently.

5. **Atomic Multi-Document Signup**:
   A single registration call creates both the `User` document and the associated profile document (`CommunityUserProfile`, `NGOProfile`, or `CSRProfile`) in an atomic transaction (with compensating rollback on standalone MongoDB instances).

6. **Role Route Protection**:
   `RoleProtectedRoute` prevents cross-role access (e.g., a community user typing `/ngo/dashboard` is blocked and redirected to their own dashboard).

---

## API Documentation

### Auth Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Register user + role profile atomically |
| `GET` | `/api/auth/verify-email/:token` | Public | Verify email address |
| `POST` | `/api/auth/login` | Public | Sign in with email + password |
| `POST` | `/api/auth/refresh` | Public (Cookie) | Issue new access token |
| `POST` | `/api/auth/logout` | Public | Invalidate refresh token & clear cookie |
| `POST` | `/api/auth/forgot-password` | Public | Request password reset email |
| `POST` | `/api/auth/reset-password/:token`| Public | Reset password with token |
| `GET` | `/api/auth/me` | Protected (Bearer) | Get authenticated user & profile |

---

## Build Roadmap
- [x] **Prompt 1** — Foundation + Authentication System
- [x] **Prompt 2** — Community User / Volunteer Dashboard & Problem Reporting
- [x] **Prompt 3** — NGO Dashboard & Problem Adoption
- [x] **Prompt 4** — CSR Manager Dashboard & Funding Allocation
- [x] **Prompt 5** — Matching Engine & Team Formation
- [x] **Prompt 6** — Contributions, Budgets & Impact Tracking
- [ ] **Prompt 7** — Verification System, Trust Scores & Notifications
- [ ] **Prompt 8** — Final UI, Admin Console & Production Polish

## Prompt 3: NGO dashboard

NGO accounts use `/ngo/dashboard`, `/ngo/profile`, `/ngo/discover-problems`,
`/ngo/projects/new`, `/ngo/projects`, and `/ngo/projects/:id`. Creating or adopting
projects requires an NGOProfile with `verificationStatus: "verified"`. Pending and
rejected NGOs can browse and edit their profiles. Verification can only be changed
by an administrator; the admin interface is intentionally deferred to Prompt 8.

### Database requirements

Adoption, linked status/completion updates, applicant review, and resource tracking
use strict MongoDB transactions. Use MongoDB Atlas or a local replica set. A
standalone database returns a clear 503 for these operations without partial writes.
For local persistent development, start MongoDB with `--replSet rs0`, initialize it
once using `rs.initiate()` in mongosh, and set a URI such as
`mongodb://localhost:27017/karmaconnect?replicaSet=rs0` with `USE_IN_MEMORY_DB=false`.
The existing `USE_IN_MEMORY_DB=true` mode attempts a temporary single-node replica
set; its contents disappear when it stops. No existing application data is seeded,
deleted or changed by the tests.

At startup, the server adds unique non-null source-problem and application-target
indexes. It replaces only the known legacy `userId_1_problemId_1` application index,
after its partial replacement exists. It stops startup on conflicting historical
source-project links instead of deleting or silently merging records.

### Verification commands

From `server`, run `npm.cmd test` on Windows (or `npm test` elsewhere). The suite
includes 78 checks across authentication, community, NGO, CSR, matching, teams and impact.
From `client`, run `npm.cmd run build` for the production frontend build.

From `server`, `node scripts/verifyNgoBrowser.mjs` exercises the complete NGO flow
and community signup/login/post/apply in headless Chrome using a temporary browser
profile and isolated database. The script currently uses the standard Windows
Chrome installation path. It writes screenshots to `artifacts/ngo-browser/` and
cleans up its uploaded test files. The first run may need the MongoDB binary download.

See `gemini.md` for reciprocal Problem/Project links, status rules, recorded
volunteer hours, resource receipt history, and the Prompt 5/6 extension boundaries.


## Prompt 4: CSR Manager dashboard

CSR accounts now use /csr/dashboard, /csr/profile, /csr/discover-projects,
/csr/projects/:id, /csr/portfolio, /csr/projects/:id/monitor, /csr/reports and
/csr/budget. Only csr_manager accounts can access these pages and the /api/csr API.
CSR managers fund and monitor NGO projects; they cannot edit or adopt them.

All funding is explicitly simulated in INR. No payment gateway is connected.
The funding POST requires an Idempotency-Key header (8-100 letters, digits,
underscores or hyphens); the browser supplies and retains it through retries.
Repeated keys cannot allocate twice. New amounts must be positive with at most two
decimal places and cannot exceed the current gap. Completed projects reject funding.

Multiple funders share a project. The latest NGO cumulative spending total is
attributed oldest allocation first, without exceeding an allocation. Unattributed
historical spending remains visible; cumulative receipt snapshots are never summed.
Only unspent allocations still in allocated status can be withdrawn. Transactions
update Funding, Project and CSRProfile totals together; replica-set MongoDB is
required, as for the NGO workflows. No existing application data is replaced.

Legacy dollar budget ranges remain stored unchanged and are not converted to INR.
The new CSR profile editor offers INR ranges for budget-based recommendations.
Company budget is displayed as the configured range; allocation remaining balance
is not presented as an exact annual company budget.

From server, run node scripts/verifyCsrBrowser.mjs for the CSR browser checks.
It uses the existing Windows Chrome setup with temporary users, a temporary browser
profile and an isolated replica set, and saves screenshots to artifacts/csr-browser/.
The existing verifyNgoBrowser.mjs still covers NGO and community regressions.

Funding statuses, spending attribution, report access, scored matching,
and the Prompt 6 contribution reconciliation boundary are documented in gemini.md.
Downloadable PDF reports and real payments remain deferred as requested.


## Prompt 5: Matching and Team workspace

Community and CSR dashboards now use scored recommendations with real point-by-point
explanations. Volunteer matching scores skills, interests, cause areas, city and a
recorded-timeline/urgency availability heuristic. CSR matching scores focus areas,
location, explicit INR budget fit and the managing NGO's track record. Partial CSR
matches remain visible; ordinary discovery filters keep their original behavior.
See gemini.md for exact weights, tie order, budget thresholds and missing-data rules.

NGOs can post skill requests from project management. Community dashboards show open
requests matching their skills, including partial/case-insensitive matches. Direct NGO
projects now have a community detail/apply page at /projects/:id.

First acceptance creates one Team; later acceptances join it. The existing NGO review
routes and /api/projects/:id/accept-applicant/:applicationId share a transactional
implementation. At startup, the server installs a unique partial Team.projectId index
and backfills legacy projects with accepted volunteers but no teamId. It preserves
existing Team records and does not create teams for empty projects. Use MongoDB 5.2+
as a replica set (or Atlas); message page projection uses the sortArray operator.

/teams/:id offers member roles, task columns, meeting scheduling and a conversation
that polls every 12 seconds. Only current members and the managing NGO can access it.
The NGO confirms removals; removal revokes access and unassigns tasks, retaining history.
Coordinator roles can manage roles/meetings; all members can collaborate on tasks and
messages. Team.members is authoritative; Project.teamMembers stays synchronized for
existing dashboards and CSR participation reports. Funding remains simulated.

Message API pages contain at most 50 messages. Use nextCursor as the before parameter
to load older history safely, including messages with identical timestamps. Messages
remain embedded as requested; migrate to a separate collection if volume grows. No
push notifications or WebSockets are included.

From server, run node scripts/verifyTeamBrowser.mjs to exercise two separate headless
Chrome sessions. It verifies scored recommendations, skill requests, apply/accept/team
links, tasks, meetings, polling, older history, busy-interval catch-up, role edits,
removal and mobile layout. Screenshots are saved in artifacts/team-browser/. The
script uses isolated test data and the same Windows Chrome setup as the prior suites.
Run npm.cmd test and the existing verifyNgoBrowser.mjs / verifyCsrBrowser.mjs scripts
for regressions. From client, run npm.cmd run build.


## Prompt 6: Contributions, shared progress and Impact Stories

Community members can record structured time, skills, simulated INR donations and
materials at /projects/:id (or through an adopted Problem). Time/skills require current
team membership. Material donations wait for the owning NGO's confirmation in the
Resources tab. Pending/rejected records do not count toward confirmed totals. Forms
retain an idempotency key on retries to prevent duplicate records.

ProgressSummary uses GET /api/projects/:id/progress-summary in community, NGO and CSR
project views. It shows the same milestone ratio, confirmed hours/materials and combined
funding breakdown to every role. Volunteer Contributions and company Funding remain
separate records; confirmed volunteer money plus non-withdrawn CSR allocations form
Project.fundingReceived. Money is simulated, never a real payment. Material estimated
value and manual inventory counts are not added to funding totals.

NGO receipt-backed cumulative spending remains the source of Project.fundingSpent.
Spending is attributed to CSR allocations oldest first, then to the volunteer pool;
any excess is visibly unattributed. Both new volunteer donations and CSR allocations
check the combined gap transactionally. The original CSR withdrawal rules still apply.

Completion through any existing NGO route creates one immutable ImpactRecord with
confirmed totals, Team member count, NGO/CSR credits, recorded outcomes and copied
photos. Later project edits and pending confirmations update live figures, not that
snapshot. /impact-stories and /impact-stories/:projectId present the stories to any
logged-in role. Contributor lists remain restricted to the owner NGO and current team
members; /my-impact shows only the current user's totals and dated contribution history.

### Historical data and startup migration

Server startup runs prepareImpact after team preparation. It preserves original
Contribution.problemId/note/amount/timestamps, links through Problem.linkedProjectId,
and marks unmeasured/unknown-currency legacy records for review rather than inventing
hours, quantities or INR conversion. Unadopted records stay intact until adoption.
NGOs can supply known structured details and explicitly attest INR for legacy money.
Repeated migration is safe; conflicting index data is never deleted automatically.

Old completed projects without ImpactRecords receive explicitly labelled reconstructed
snapshots. Unknown original completion dates remain null; reconstructed membership and
photos reflect the available backfill records. Existing snapshots never get overwritten.
Old manual volunteerHours remain separate evidence. For projects with confirmed
structured hours, NGO totals prefer contributionHours instead of adding overlapping
manual and structured records. Impact snapshots always use Contribution hours only.

Run node scripts/impactMigrationReport.mjs from server for a read-only report of
unlinked/review-needed records and completed projects lacking snapshots. It uses the
configured database; USE_IN_MEMORY_DB=true is temporary development storage, not a
report of persistent production data. Existing replica-set requirements still apply.

### Verification

From server: npm.cmd test, node scripts/verifyImpactBrowser.mjs,
node scripts/verifyNgoBrowser.mjs, node scripts/verifyCsrBrowser.mjs, and
node scripts/verifyTeamBrowser.mjs. Run browser suites sequentially to avoid competing
Vite dependency optimization/startup in the shared workspace. Browser fixtures use
isolated databases and temporary Chrome profiles. The impact fixture uses an existing
local uploads image as test evidence only; it does not modify that file or live records.
Impact screenshots are saved in artifacts/impact-browser/.
From client: npm.cmd run build.

Notifications, new verification badges, exports and real payment processing remain
outside this prompt. See gemini.md for aggregation and future notification boundaries.

## Prompt 7: verification, reports and notifications

Notifications are stored in MongoDB and delivered in-app only. The shared navbar
bell polls every 30 seconds; /notifications supports pagination, read/unread
filters, deletion and marking all read. No push, SMS or WebSocket delivery is used.
Role-appropriate project links preserve existing dashboard permissions.

Events include application review/new applications, CSR allocations and funding
status changes, team messages, skill matches, recorded/confirmed contributions,
project completion and verification review. New reports notify existing admins.
Team messages use a rolling 60-second throttle per recipient/project/sender.
Incomplete milestones due in the next 48 hours are checked when the NGO dashboard
or bell loads; each milestone/due-date combination produces one reminder.
Transactional writes and event keys protect retries and rollbacks. Startup
backfills and demo seeding do not broadcast historical notifications.

Organizations upload PDF/JPEG/PNG/WebP evidence from their profile pages: up to
4 files per request, 5 MB per file, 20 files per profile. Files have checked content
signatures and live under .local/verification-evidence, outside public uploads.
Downloads require an authenticated owner or admin; URLs alone do not grant access.
New evidence sets verification to pending. Internal review notes never appear in
organization or public profile responses. Failed requests clean up uploaded files.

LARGE_PROJECT_THRESHOLD defaults to 50000 INR. A larger fundingRequired sets
requiresAuthorityApproval; the flag is recalculated for existing projects on
startup and on budget edits. It signals evidence review, without adding a new
funding/completion gate. Admin-reviewed before/after evidence receives a badge;
changing either gallery clears it. Trust badges show current organization/project
verification alongside unchanged historical impact totals. Reports can flag
problems/projects for review but never automatically remove them.

### API contracts for the Prompt 8 admin UI

All paths below are relative to /api. List pagination uses page and limit
(default 20, maximum 50). IDs must be valid for their specific target collection.

| Method and path | Body / behavior |
| --- | --- |
| GET /notifications | Optional isRead=true or false; newest first |
| GET /notifications/unread-count | Recipient's unread count |
| PATCH /notifications/:id/read | Optional isRead boolean (default true; false marks unread) |
| PATCH /notifications/mark-all-read | Recipient only |
| DELETE /notifications/:id | Recipient only |
| GET/POST /ngo/me/verification-evidence | NGO's evidence; POST multipart documents plus type |
| GET/POST /csr/me/verification-evidence | CSR equivalent |
| GET /verification-evidence/:type/:id/:filename | Private authenticated download |
| GET /projects/:id/trust | Public trust fields for authenticated users |
| POST /reports | targetType, targetId, reason, description; maximum 10/hour per account |
| GET /admin/verifications/pending | Pending organization profiles with evidence and internal notes |
| PATCH /admin/verifications/:profileType/:profileId | profileType=ngo/csr; verificationStatus=verified/rejected, verificationNotes |
| PATCH /admin/projects/:id/verify-evidence | Mark existing before/after evidence reviewed |
| GET /admin/reports | Optional status/targetType; pending first, then newest |
| PATCH /admin/reports/:id | status, reviewNotes, optional flagTarget=true for action_taken on problem/project |

Evidence type is registration_doc, reference_letter or other. Report targetType
is problem, project, user, ngo or csr_profile; ngo and csr_profile target profile
IDs, not account IDs. Report reason is fake_problem, fake_project,
misleading_information, suspicious_activity, inappropriate_content or other.
Report status is pending, reviewed, action_taken or dismissed.

All /admin paths require the admin role; no admin UI or self-service admin account
creation is introduced. Notification enum values new_matching_project and
team_invitation are reserved for future flows; no invitation workflow is invented.

Run backend checks with npm run test:server. The new isolated browser check is
node scripts/verifyTrustBrowser.mjs from the server directory. It exercises
real polling, reports, evidence uploads, admin API review, badges and mobile UI.

## Administrator setup and operations

Use the existing persistent MongoDB replica set and `USE_IN_MEMORY_DB=false`.
Supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your local server environment, then run
from the repository root:

```powershell
node server/scripts/createAdmin.js
```

The password must contain at least 8 characters and no more than 72 UTF-8 bytes.
The script hashes it, creates one verified administrator, and never prints the
password. It does not promote or overwrite an existing account. A repeated run
is a no-op when any administrator exists; concurrent first runs create only one.
No live administrator is created by tests or by application startup.

Sign in at `/login` and open `/admin/dashboard`. The admin shell includes platform
statistics, organization verification/history, reported-content review, users,
category usage and project evidence review. Additional administrators can be
created through User management. Public signup continues to accept only the three
participant roles. All `/api/admin/*` endpoints require an active administrator;
all `/admin/*` frontend routes are guarded, including unknown child routes.

Suspension blocks login, refresh and existing access tokens and revokes refresh
sessions. Reactivation requires a fresh login. Administrators cannot suspend
themselves or leave the platform without an active administrator. Existing data
is retained.

New endpoints (in addition to the Prompt 7 review APIs):

| Method and path | Purpose |
| --- | --- |
| POST `/api/admin/create-admin` | Create an additional administrator with name, email and password |
| GET `/api/admin/stats/overview` | Platform totals, role/status breakdowns and pending queues |
| GET `/api/admin/stats/growth?interval=month` | Twelve UTC monthly periods; `week` uses Monday boundaries |
| GET `/api/admin/users` | Paginated users; optional role and literal name/email search |
| GET `/api/admin/users/:id` | Safe account and role-profile details |
| PATCH `/api/admin/users/:id/suspend` | Suspend and revoke sessions |
| PATCH `/api/admin/users/:id/reactivate` | Restore ability to sign in |
| GET `/api/admin/categories` | Existing enum categories and document usage counts |
| GET `/api/admin/verifications?status=pending` | Paginated pending, verified or rejected organization profiles |
| GET `/api/admin/reports/:id` | Reporter and typed content preview, with deleted-target handling |
| GET `/api/admin/projects/pending-verification` | Large-project evidence queue |

Verification approve/reject actions require `verificationNotes`. History shows the
current decision and most recent review, not a complete audit log. Evidence files
remain private and use authenticated downloads. Categories remain schema enums;
adding dynamic categories requires a future migration. The disabled Add Category
control explains that limitation.

Statistics exclude withdrawn CSR allocations and unconfirmed/legacy volunteer
contributions. Combined funding is active CSR allocations plus confirmed volunteer
money; hours sum confirmed time and skill sessions once. Beneficiaries come from
structured completion snapshots. Category totals count Problem and Project
documents separately, including both sides of an adopted problem. All financial
values are simulated INR; there is no payment gateway.

Admin verification commands, from `server`:

```powershell
node --test tests/adminPrompt8.test.js
node scripts/verifyAdminBrowser.mjs
node scripts/verifyPolishBrowser.mjs
```

These use isolated temporary databases and browser profiles. Browser scripts
require the locally installed Chrome path used by the existing regression scripts.

### Local MongoDB startup

With the project's local URI on port 27018 and `USE_IN_MEMORY_DB=false`,
`npm run dev` in `server` starts the persistent `karmaLocal` replica set before
starting the API. Existing data stays in `.local/mongodb`. You can also start only
MongoDB with `npm run db:start`. Repeated starts reuse the running instance.

The helper uses the existing cached Windows MongoDB 7.0.24 binary, or `mongod`
on PATH. Set `MONGOD_BINARY` to override the executable path. It applies only to
the project's exact local development URI, never production, test or remote DBs.
When `USE_IN_MEMORY_DB=false`, an unavailable persistent database now stops startup
instead of silently switching to a new temporary database. MongoDB logs are in
`.local/mongodb/mongod.log`.
