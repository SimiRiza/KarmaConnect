# KarmaConnect

KarmaConnect connects community members, NGOs and corporate social responsibility
(CSR) teams around local problems: discover a need, organize a project, contribute
resources and record its impact.

## Features

- Separate community, NGO, CSR and administrator dashboards with server-side role checks.
- Problem reporting and discovery, NGO adoption and project management.
- Volunteer matching, applications, teams, tasks, meetings and messages.
- Time, skill and material contributions, simulated INR funding and spending records.
- Project progress, completion evidence and impact stories.
- Organization verification, private evidence downloads, reporting and administration.
- Email verification/password resets, JWT access tokens and HttpOnly refresh cookies.

Funding is simulated: the application does not collect payments. Notifications use
polling. Categories are fixed schema values; organization verification history
contains the latest review rather than a complete audit trail.

## Stack

React 18, React Router, Vite, Tailwind CSS and Axios on the frontend; Node.js,
Express, Mongoose/MongoDB, bcrypt, JWT and Nodemailer on the backend. Tests use
Node's test runner, Supertest and isolated MongoDB processes. Browser integration
scripts use Chrome and the Chrome DevTools Protocol.

## Setup

Use Node.js 24 (the version used for verification), npm and MongoDB. Run these
commands from the project root; in Windows PowerShell use `npm.cmd` if execution
policy blocks `npm.ps1`.

```powershell
npm.cmd ci
npm.cmd ci --prefix server
npm.cmd ci --prefix client
Copy-Item .env.example server/.env
```

Do not overwrite an existing `server/.env`. Keep it private. The checked-in example
contains blank credentials and development defaults. Installed dependencies,
runtime uploads, local databases, build output and test artifacts are excluded
by `.gitignore` and should not be published.

For the existing standalone local database, set in `server/.env`:

```dotenv
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/karmaconnect
USE_IN_MEMORY_DB=false
```

Start your installed MongoDB service if necessary (Windows service name is usually
`MongoDB`; starting it may require an elevated PowerShell window):

```powershell
Get-Service MongoDB
Start-Service MongoDB
mongosh "mongodb://localhost:27017/karmaconnect" --eval 'db.runCommand({ping:1}); db.users.countDocuments()'
```

These commands do not change MongoDB's topology. If MongoDB was installed without
a service, start it using your existing data directory and configuration.

**Standalone development startup:** a prepared local standalone database can be
used with an explicit startup-only opt-in. From the root in PowerShell:

```powershell
$env:NODE_ENV = 'development'
$env:MONGODB_URI = 'mongodb://localhost:27017/karmaconnect'
$env:USE_IN_MEMORY_DB = 'false'
$env:ALLOW_STANDALONE_DEV_STARTUP = 'true'
npm.cmd run dev --prefix server
```

Alternatively set the flag in your private `server/.env`. It is disabled by
default and is rejected outside development or for non-loopback hosts. Never
enable it in production. Before any startup preparation, read-only checks refuse
pending team backfills, legacy/unlinked contributions, completed projects without
impact snapshots, and progress percentages that differ from the existing milestone
calculation. Prepare such data using a transaction-capable MongoDB rather than
forcing startup or deleting records.

When eligible, startup still creates indexes and performs its other existing safe
preparation, but skips team backfill and impact migration/reconciliation. It does
not run them nontransactionally. Replica-set/mongos startup is unchanged.

**Runtime limitation:** authentication and compatible operations can work locally,
but transaction-dependent project/funding/team operations and some progress-summary
reads still fail with their existing errors on standalone MongoDB. The opt-in is
not a generic transaction fallback. Full application operation requires a
transaction-capable deployment. The separate demo-seed opt-in is unchanged.

## Run

From the root, run both services:

```powershell
npm.cmd run dev
```

Or run them in separate terminals:

```powershell
npm.cmd run dev --prefix server
npm.cmd run dev --prefix client
```

Frontend: `http://localhost:5173`. Backend health check:
`http://localhost:5000/api/health`. Vite proxies `/api` and `/uploads` to the backend
in development. The backend must finish startup before API requests can work.
Restart the backend after changing environment settings. Shell environment
variables override `server/.env` when launched with the commands above.

The existing `server/scripts/startLocalMongo.js` helper only starts the optional
local replica set if its exact port-27018 URI is already configured. It does not
start or convert the standalone MongoDB on port 27017.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT`, `CLIENT_URL` | Runtime mode, API port and frontend origin/email-link base |
| `MONGODB_URI`, `USE_IN_MEMORY_DB` | Database selection; use `false` for persistent data |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Separate random signing secrets; production requires at least 32 characters each |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token lifetimes; defaults are 15 minutes and 7 days |
| `REQUIRE_EMAIL_VERIFICATION` | Require verification before login when `true` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Email delivery; required in production |
| `UPLOAD_DIR`, `VERIFICATION_EVIDENCE_DIR` | Separate absolute durable storage paths required in production |
| `TRUST_PROXY` | Optional explicit trusted proxy addresses/subnets; unset means no proxy trust |
| `LARGE_PROJECT_THRESHOLD` | INR budget threshold for authority evidence review; default 50000 |
| `ALLOW_STANDALONE_DEMO_SEED` | Explicit seed-only local development opt-in; default `false` |
| `ALLOW_STANDALONE_DEV_STARTUP` | Explicit local development startup-only opt-in; default `false`; never enable in production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Operator-supplied first-administrator credentials |

Development can use fallback JWT keys and console email links. Production rejects
missing/unsafe configuration, in-memory mode and a standalone database. Never use
development secrets or shared demo credentials for a real production account.

## Fictional demo data

The supported demo script is `server/scripts/seedDemoData.js`. It uses the same
`server/.env` and shell overrides as the application; it does not use a separate
root-only `.env` fallback. Keep MongoDB running, stop application writes and run
only one seed command at a time.

For your local standalone MongoDB, from the root:

```powershell
$env:NODE_ENV = 'development'
$env:MONGODB_URI = 'mongodb://localhost:27017/karmaconnect'
$env:USE_IN_MEMORY_DB = 'false'
$env:ALLOW_STANDALONE_DEMO_SEED = 'true'
node server/scripts/seedDemoData.js
```

This creates 8 community accounts, 3 NGOs, 3 CSR accounts, 8 problems, 6 projects,
teams, applications, contributions, simulated funding and 2 impact stories.
All people, organizations and outcomes are fictional. Placeholder images require
internet access.

| Accounts | Shared demo password |
| --- | --- |
| `volunteer1` through `volunteer8` at `demo.karmaconnect.test` | `Demo@1234` |
| `ngo1` through `ngo3` at `demo.karmaconnect.test` | `Demo@1234` |
| `csr1` through `csr3` at `demo.karmaconnect.test` | `Demo@1234` |

For example: `volunteer1@demo.karmaconnect.test` / `Demo@1234`.

Replica-set/mongos seeding retains atomic transactions. Standalone seeding requires
`NODE_ENV=development`, an explicit opt-in and a loopback host. All demo seeding,
including `--clear`, is forbidden when `NODE_ENV=production`.

Reseeding replaces only `isSeedData: true` records; non-demo email collisions abort
before cleanup. Standalone seeding is **not atomic**: failed runs attempt to clean
up new records but cannot restore previously deleted demo data. An interrupted
process can leave partial records, including an untagged impact snapshot if it
stops between snapshot creation and tagging. Inspect interrupted runs; never
broadly delete untagged application data. To clear only tagged demo records with
the same environment settings:

```powershell
node server/scripts/seedDemoData.js --clear
```

## Administrator setup

Provide `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` through private environment
settings, then run `node server/scripts/createAdmin.js` from the root. Bootstrap
uses a persistent database, never promotes an existing account, and is a no-op
when an administrator already exists. It does not print the password. Sign in at
`/login`, then open `/admin/dashboard`. Public signup cannot create administrators.

## Tests and build

```powershell
npm.cmd run test:server
npm.cmd run build:client
```

The complete backend suite includes production-readiness tests and demo seed tests.
They use isolated temporary MongoDB instances; the MongoDB test binary may need
to download on first use. No live database needs to be seeded for those tests.
To run the focused checks individually:

```powershell
Push-Location server
node --test tests/productionReadiness.test.js
node --test tests/seedDemoData.test.js
Pop-Location
```

Run the eight existing browser integration scripts from `server`:

```powershell
Set-Location server
Get-ChildItem scripts/verify*Browser.mjs | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Browser verification failed: $($_.Name)" }
}
```

These scripts require Windows Chrome at its standard installation location and
use temporary browser profiles/databases. Keep their existing local upload fixture
available; several scripts select a JPEG/PNG from `server/uploads`. New checkouts
need a disposable test image in that ignored directory before these browser tests.
They generate ignored screenshots in `artifacts`; those are not source assets.
The Vite build produces `client/dist`, which is generated rather than source code.

## Deployment

See [production configuration](docs/production-readiness.md) for the complete
operator checklist. A small deployment needs the built frontend, a Node backend,
a persistent transaction-capable MongoDB deployment, durable public/private file
storage, working SMTP, HTTPS, and the documented server environment variables.
Use same-origin frontend/API routing: forward `/api` and `/uploads` to Express
before applying the frontend `index.html` fallback. `vite preview` is only a local
build preview. No deployment provider or infrastructure is configured by this project.

## Structure

```text
client/
  src/                  React pages, components, context and API services
  index.html            Frontend entry document
  vite.config.js        Development API/upload proxy
server/
  config/               Environment, database and storage safeguards
  controllers/          API controllers
  middleware/           Authentication, validation, uploads and error handling
  models/               Mongoose schemas
  routes/               API route definitions
  services/             Application workflows and calculations
  utils/                Shared server helpers
  scripts/              Demo/admin setup, maintenance and browser checks
  tests/                Existing backend and safety regression tests
docs/production-readiness.md
brandguidelines.md       Product language and visual guidance
.env.example            Safe environment template
.gitignore              Public-source exclusions
package.json            Root development/test/build commands
```
