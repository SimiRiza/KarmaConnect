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
- [x] Prompt 3 — NGO Dashboard
- [ ] Prompt 4 — CSR Manager Dashboard
- [ ] Prompt 5 — Matching + Team Formation
- [ ] Prompt 6 — Contributions + Impact Tracking
- [ ] Prompt 7 — Verification + Trust + Notifications
- [ ] Prompt 8 — Final UI + Admin + Polish

## Known decisions already made (don't re-litigate these without reason)
- Signup uses the existing transaction helper, including its pre-existing
  standalone fallback. Prompt 3 NGO operations use strict transactions instead.
- Project and Problem are expanded through Prompt 3. Team, Contribution,
  ImpactRecord and Notification retain their existing future-prompt extension points.
- Prompt 2 adds the minimal Community User problem flow: Problem stores title,
  description, category, photos, location.city/area, urgency, status, and
  estimatedResourcesNeeded; Application records userId, problemId,
  contributionType, relevantSkills, note, and status; Contribution records a
  userId + problemId + type + note + amount placeholder for future payment
  integration, without changing the base Prompt 1 schema.
- Color/status conventions are fixed: see brandguidelines.md status color list

### Prompt 3 decisions and verification
- NGO pages and /api/ngo routes allow only the ngo role. Pending/rejected NGOs
  can browse and maintain profiles; creating/adopting requires a verified
  NGOProfile. No self-verification endpoint exists; admin tools remain Prompt 8.
- A Project belongs to ngoId and optionally references sourceProblemId. Adoption
  creates that project and sets Problem.adoptedByNgoId + linkedProjectId + status
  in one strict MongoDB transaction. Concurrent adoption has one winner; failure
  rolls back both records. Direct projects have sourceProblemId=null.
- NGO operations that change linked records require a MongoDB replica set/Atlas.
  There is no standalone fallback for adoption, status/completion, applicant review,
  or resource transactions. The pre-existing signup behavior is preserved.
- Project statuses advance one step: reported -> adopted -> team_forming ->
  funding_needed -> in_progress -> completed. Direct projects start adopted.
  PUT/status/complete share validation. Completion requires a positive beneficiary
  count and an after photo, synchronizes the source Problem, and recalculates stats.
- Project.volunteerHours records actual aggregate hours entered by the NGO (default
  zero); completed totals are summed, never estimated from team size. Completed
  beneficiary/hour edits recalculate NGO stats transactionally. Detailed logs are
  future work. Concurrent completion is serialized through the NGOProfile.
- Existing problem-linked Applications remain discoverable through sourceProblemId;
  project-linked records use projectId. Exactly one target is required. Partial
  unique indexes preserve per-user/per-target deduplication. Startup installs the
  new constraints before replacing the known old application index, without
  deleting documents; conflicting source-project records require manual resolution.
- Accept/reject operates on pending applications (same-decision retries are safe).
  Acceptance adds users to Project.teamMembers atomically and without duplicates.
  Prompt 5 extends this array into the full team workspace/chat/tasks.
- Resource updates persist receiptNote as Project.resourceUpdates[].note with
  timestamp, spending total and material snapshots. General edits cannot change
  received quantities. Funding displays required, collected, spent, remaining
  balance and shortfall. fundingReceived remains server-controlled; Prompt 6 adds
  actual contribution/payment wiring, with no fake collected funds now.
- NGOProfile supports photos and simple team member cards; verification and impact
  totals are read-only to NGO clients. Photos use shared multer local storage with
  a future cloud-storage replacement point. Vite proxies /uploads as well as /api.
- Discovery now shares filtering/pagination/sanitization across community and NGO
  routes, with resources filtering and numeric urgency sorting before pagination.
  Nearby means exact city/served-location matches; without locations the dashboard
  explicitly shows all locations. Funding-needed count means noncompleted projects
  whose fundingRequired exceeds fundingReceived.
- Canonical API paths follow Prompt 3; previous partial NGO route aliases remain.
  No CSR dashboard, matching, chat, notifications or admin verification UI was added.
- Regression repair: CommunityDashboard was missing ApplyModal and ProblemCard
  imports; community problem validation rejected its own /uploads image URLs.
  Both are fixed, preserving the existing community flows.
- Verification: 34 Node/Supertest tests passed using isolated memory replica sets;
  frontend production build passed. Headless Chrome exercised NGO profile editing,
  adopt-prefill, direct creation, material/milestone forms, applications, resources,
  actual multipart uploads, completion, mobile layout, all NGO role guards, and
  community signup/login/post/apply. Rollback was tested with an injected failure
  between writes, plus competing adoption and simultaneous completion requests.
