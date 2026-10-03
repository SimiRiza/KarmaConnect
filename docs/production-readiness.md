# Production configuration

These instructions do not select a hosting provider or deploy the application.
Existing features, database schemas, relative API URLs and refresh-cookie policy
are unchanged. Development defaults remain available outside production.

## Required server environment

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | Your exact frontend HTTPS origin, without a path or trailing slash |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Two different cryptographically random secrets, each at least 32 characters; keep them in server-side secret settings |
| `MONGODB_URI` | Persistent MongoDB replica set or sharded deployment supporting transactions |
| `USE_IN_MEMORY_DB` | `false` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Working SMTP connection and credentials; port must be 1–65535 (465 uses implicit TLS, other ports use Nodemailer's existing STARTTLS behavior) |
| `EMAIL_FROM` | Sender mailbox/display address authorized by your mail service |
| `UPLOAD_DIR` | Absolute public-photo directory on durable storage |
| `VERIFICATION_EVIDENCE_DIR` | Separate absolute private-document directory on durable storage |

Keep these values out of the frontend build, repository and logs. Shell/host
environment variables override `.env`. Launch using `npm start --prefix server`
from the repository root (or `npm start` in `server`); `.env` is read from the
server working directory. Production startup rejects missing configuration before
connecting to MongoDB or accepting traffic. It also rejects a standalone MongoDB
topology before running the existing startup migrations/index preparation.

`PORT` retains the default 5000 if the host does not set it. Explicitly choose
`REQUIRE_EMAIL_VERIFICATION=true` to require verification before login; its existing
default/behavior is unchanged. JWT expiration settings retain their existing
defaults. Use the existing administrator bootstrap instructions in README with
operator-supplied `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Routing on your existing host

Build with `npm run build:client`; serve `client/dist` through your existing
frontend host. The API remains the existing Express service. Configure routing in
this order on the same HTTPS origin:

1. `/api` and `/api/*` go to Express, preserving methods, cookies and headers.
2. `/uploads` and `/uploads/*` go to Express (which reads `UPLOAD_DIR`).
3. Serve the built frontend files; fall back to `index.html` for frontend navigation
   such as `/login` or `/ngo/dashboard`.

Do not rewrite API or missing-upload responses into SPA HTML. Vite's development
proxy is not included in `client/dist`. Neither `vite dev` nor `vite preview` is
the production serving configuration. No server-side SPA fallback is added here:
the host that serves the frontend must own that rule.

The current frontend uses relative `/api` and `/uploads` URLs, including the token
refresh request. Production refresh cookies remain Secure, HttpOnly and
SameSite=Strict. Keep same-origin routing; unrelated frontend/API domains would
need a separately reviewed routing/authentication change.

## Storage and database responsibilities

Mount durable storage at both configured directories with read/write access for
the server account. Startup checks paths and access, but cannot detect whether a
host filesystem survives restarts/redeploys. Verify persistence yourself, including
all instances accessing the same files if you run more than one API instance.
Do not choose temporary/build directories. Back up the database and files.

Public uploads and private evidence must not overlap. Never expose evidence through
your static host, reverse proxy, public bucket, or a symlink inside a public tree.
The app continues to serve evidence only through its authenticated authorization
checks. Existing URLs are unchanged. If carrying existing data into production,
copy photos from `server/uploads` and documents from `.local/verification-evidence`
to their configured destinations with filenames intact. Review demo records and
shared demo credentials before opening access; no data is removed automatically.

## Proxy trust, CORS and CSP

Production CORS allows only `CLIENT_URL`; development remains permissive. Requests
without an Origin header remain supported, with the existing API authentication.
CORS is a browser policy, not an authentication mechanism.

`TRUST_PROXY` is optional and defaults to no trust. If your deployment uses a reverse
proxy, supply only its actual trusted IP addresses/subnets, comma-separated.
The app deliberately rejects boolean values, hop counts and `/0` ranges. The
proxy must overwrite forwarded headers and the backend must not be reachable
through an untrusted path matching the trusted ranges. Incorrect configuration
can group users under one rate-limit IP or let callers spoof client addresses.
Do not copy an arbitrary setting: obtain the correct topology from your existing host.

CSP enforcement is unchanged. The frontend loads Google Fonts, data-URL icons,
inline styles and externally hosted/user-provided photos. A guessed restrictive
policy could break these. Evaluate a report-only policy on the actual frontend
host before enabling enforcement; API Helmet headers alone do not define the
policy of a separately served HTML document.

## Email and final operator checks

Production never uses console email delivery. Missing SMTP configuration stops
startup; runtime delivery failures return a safe 503 instead of success or raw
SMTP diagnostics. No production reset/verification links are logged. Config
validation does not establish actual delivery: verify sender authorization,
SMTP connectivity and inbox delivery using your own accounts before launch.

Account creation already commits before verification mail is sent. A delivery
failure leaves that account intact; this patch adds no destructive rollback or
new resend feature. Fix delivery before inviting users. If an account is stranded
unverified, an operator must resolve it using the existing operational processes.
Reset requests may be retried after delivery is restored. Development retains its
existing console links and non-fatal SMTP behavior.

Before opening access, verify signup/verification, login, page reload/session
restoration, logout, password reset, public-photo upload/retrieval, authorized
private-document upload/download, role restrictions, deep-link refresh, and
persistence after restart. Funding remains simulated; no payments are collected.

## Local verification (3 October 2026)

All 100 existing backend tests and 8 production-safety regression tests passed.
The new tests include development authentication against an isolated replica set,
real startup rejection of missing configuration, production CORS/custom storage,
private-file protection and SMTP failure handling without real delivery. The
production frontend build passed; its existing 522.59 kB bundle-size warning
remains. These checks do not verify your eventual hosting routes, storage durability
or real SMTP delivery. No deployment was performed.
