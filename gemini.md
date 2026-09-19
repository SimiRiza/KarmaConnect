# KarmaConnect — Project Context for AI Agent

## What this project is
KarmaConnect is a community-impact platform connecting local problems with
NGOs, volunteers, and CSR-funded companies. Core flow:
Post/Discover Problem → Match → Form Team → Contribute → Solve → Track Impact.

Three account types: Community User (student / working professional /
general volunteer), NGO, CSR Manager/Company.

Full feature reference: see /docs/brandguidelines.md for tone/visual rules,
and the project's build-prompt history for the full 8-part feature spec
(Foundation+Auth, User Dashboard, NGO Dashboard, CSR Dashboard, Matching+Teams,
Contributions+Impact, Verification+Notifications, Admin+Polish).

## Tech stack (do not deviate without asking)
- Frontend: React (Vite) + React Router v6 + Tailwind CSS
- State: React Context API for auth/session
- Backend: Node.js + Express.js
- Database: MongoDB + Mongoose
- Auth: JWT access token (in-memory, NOT localStorage) + httpOnly refresh
  token cookie, bcrypt password hashing
- Email: Nodemailer

## Critical build rules
1. NEVER rebuild or remove existing functionality when extending the app.
   Always preserve the current database schema, authentication, UI, and
   features already built. Each new prompt ADDS a layer on top of the last.
2. Keep the three dashboards (Community User, NGO, CSR Manager) strictly
   role-separated. A user of one role must never be able to view another
   role's dashboard, even by direct URL — always enforce this both in
   frontend routing (RoleProtectedRoute) and backend middleware (authorize()).
3. Access tokens live in memory only, never in localStorage. Refresh tokens
   are httpOnly cookies only.
4. Never expose password hashes, JWT secrets, or SMTP credentials in any API
   response or client-side code.
5. Money/contribution data must always show: required, collected, spent,
   remaining — this transparency requirement is non-negotiable per brand
   guidelines.
6. Keep controllers thin — business logic belongs in service files.
7. Every new model should follow the existing schema patterns already
   established (see /server/models/) rather than introducing a new style.

## Current build status
(Update this section after each prompt is completed, so future sessions know
exactly where the build stands.)

- [x] Prompt 1 — Foundation + Authentication
- [x] Prompt 2 — Community User/Volunteer Dashboard
- [ ] Prompt 3 — NGO Dashboard
- [ ] Prompt 4 — CSR Manager Dashboard
- [ ] Prompt 5 — Matching + Team Formation
- [ ] Prompt 6 — Contributions + Impact Tracking
- [ ] Prompt 7 — Verification + Trust + Notifications
- [ ] Prompt 8 — Final UI + Admin + Polish

## Known decisions already made (don't re-litigate these without reason)
- MongoDB transactions are used when creating a User + role profile together
  at signup, so a half-created account can never exist
- Placeholder Mongoose models already exist for Project, Problem, Team,
  Contribution, ImpactRecord, Notification — extend these, don't recreate them
- Prompt 2 adds the minimal Community User problem flow: Problem stores title,
  description, category, photos, location.city/area, urgency, status, and
  estimatedResourcesNeeded; Application records userId, problemId,
  contributionType, relevantSkills, note, and status; Contribution records a
  userId + problemId + type + note + amount placeholder for future payment
  integration, without changing the base Prompt 1 schema.
- Color/status conventions are fixed: see brandguidelines.md status color list