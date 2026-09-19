# KarmaConnect

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
| `JWT_SECRET` | 32+ char secret for 15-min access tokens | (random secret) |
| `JWT_REFRESH_SECRET` | 32+ char secret for 7-day refresh tokens | (random secret) |
| `REQUIRE_EMAIL_VERIFICATION` | Require email verification before login | `false` (for dev) / `true` |
| `SMTP_HOST` | SMTP server host (optional in dev) | `smtp.mailtrap.io` |
| `EMAIL_FROM` | Outgoing sender display and address | `KarmaConnect <noreply@karmaconnect.org>` |

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
- [ ] **Prompt 2** — Community User / Volunteer Dashboard & Problem Reporting
- [ ] **Prompt 3** — NGO Dashboard & Problem Adoption
- [ ] **Prompt 4** — CSR Manager Dashboard & Funding Allocation
- [ ] **Prompt 5** — Matching Engine & Team Formation
- [ ] **Prompt 6** — Contributions, Budgets & Impact Tracking
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
includes 49 checks across authentication, community, NGO and CSR workflows.
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

Funding statuses, spending attribution, report access, temporary category matching,
and the Prompt 6 contribution reconciliation boundary are documented in gemini.md.
Downloadable PDF reports and real payments remain deferred as requested.
