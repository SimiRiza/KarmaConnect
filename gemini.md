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
- [x] Prompt 4 — CSR Manager Dashboard
- [x] Prompt 5 — Matching + Team Formation
- [x] Prompt 6 — Contributions + Impact Tracking
- [ ] Prompt 7 — Verification + Trust + Notifications
- [ ] Prompt 8 — Final UI + Admin + Polish

## Known decisions already made (don't re-litigate these without reason)
- Signup uses the existing transaction helper, including its pre-existing
  standalone fallback. Prompt 3 NGO operations use strict transactions instead.
- Project and Problem are expanded through Prompt 3. Contribution,
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
  balance and shortfall. fundingReceived remains server-controlled; Prompt 4 adds
  explicitly simulated CSR allocations and Prompt 6 adds real contribution/payment wiring.
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


### Prompt 4 decisions and verification
- The complete CSR experience is under /csr/* and /api/csr, authorized strictly
  for csr_manager. CSR users evaluate NGO-managed Projects; they cannot create,
  edit, adopt, manage resources or change Project status. NGO/community role guards
  remain intact. CSR verification is read-only; simulated allocation has no added
  CSR verification gate. All editable CSR profile writes are allowlisted.
- Funding is a new model: csrUserId, projectId, amountAllocated, amountSpentSoFar,
  allocationDate, status, notes, timestamps, and an internal idempotencyKey.
  Amounts are simulated INR, validated to two decimals and calculated in integer
  paise before persisting the requested Number fields. No payment is collected.
  Real payment integration is required before treating these as actual funds.
- POST /api/csr/projects/:id/fund requires an Idempotency-Key header (8-100 letters,
  digits, underscores or hyphens; body idempotencyKey is also accepted). Keys are
  unique per CSR account. Identical retries return the existing allocation; reusing
  a key with a changed project/amount/notes returns 409. Multiple intentional
  allocations per company/project are supported with separate keys.
- recalculateProjectFunding(projectId, session) is the single reconciliation path
  for allocation, withdrawal and funded NGO resource/status/completion updates.
  It sums non-withdrawn allocation amounts into Project.fundingReceived and derives
  unique Project.fundedBy. Funding, Project and all affected CSRProfile stats are
  updated in a strict transaction; Project writes and ordered CSRProfile writes
  serialize concurrent allocations, spending, withdrawals and completions.
- NGO resourceUpdates contains cumulative spending snapshots, not incremental
  expenses. Reconciliation uses the latest snapshot, or the existing fundingSpent
  when no history exists. It never adds cumulative snapshots together. Spending
  is attributed oldest allocation first (allocationDate then _id), capped at each
  allocation's amount. Historical spending exceeding allocations is preserved and
  displayed as unattributed project spending; later allocations can cover it.
  The CSR amountSpentSoFar sum plus unattributed spending equals project spending.
- Spending corrections retain the existing required receipt note/history and
  recalculate allocations and company totals. Withdrawn allocations are retained
  as history and excluded from current totals/fundedBy. Withdrawal is allowed only
  when status=allocated and amountSpentSoFar=0; repeated withdrawal is idempotent.
- Funding status is completed when its Project completes, in_progress while the
  Project is in_progress or the allocation has spending, otherwise allocated.
  Withdrawn is terminal. New funding is rejected for completed projects or amounts
  exceeding the current gap; the gap is checked inside the transaction. Receiving
  funding does not automatically advance the NGO's project status pipeline.
- recalculateCsrStats and portfolioSummary deduplicate projects across allocation
  records. Profiles track allocated/spent, active/completed counts, completed
  project beneficiaries and distinct NGOs. Volunteer participation is team size
  summed once per funded project, not distinct people across the whole portfolio.
  Edits to completed beneficiary counts refresh every affected CSR profile.
- CSR reports/monitoring require a non-withdrawn allocation owned by the caller.
  Own withdrawn Funding history remains viewable. Evaluation projects are browsable
  by CSR accounts; other funders' private notes and volunteer identities are omitted.
  Reports distinguish the caller's allocated/spent/remaining share from project-wide
  required/received/spent/remaining/unattributed figures and estimated vs reached
  beneficiaries. Reports are JSON plus presentable UI; PDF/export remains Prompt 8.
- Project discovery defaults to unfinished projects with a funding gap. The
  includeFullyFunded toggle broadens this. Filters cover category/cause, city/area,
  required-funding range, NGO verification, beneficiary range, source-Problem urgency
  and timeline duration. Direct projects have unspecified urgency; absent timeline
  duration is excluded only when a duration filter is requested.
- Matching is deliberately a temporary category filter-and-sort. Existing signup
  focus labels map explicitly to Project categories; category overlap is 0 or 1
  because Project has one category. Prompt 5 replaces this with real matching.
- CSRProfile.budgetRange remains a string. The new profile editor offers explicit
  INR ranges and preserves existing legacy dollar values. Legacy dollar ranges are
  never silently converted into INR. Recommendations apply a budget filter only
  for a parseable INR range; the UI explains when that filter is not set. No exact
  annual company budget is invented: budget pages show allocation balances.
- Project has no separate issue log or per-photo/milestone event timestamps.
  Monitoring derives overdue date warnings and shows existing resource notes.
  Recent activity is explicitly current evidence with Project.updatedAt, not a
  fabricated event feed. No new notification, chat or matching model was added.
- Prompt 6 must reconcile volunteer Contribution money with these simulated Funding
  records explicitly. Contribution amounts remain separate today and are not counted
  twice. Do not blindly sum resource snapshots, attribute a full project cost to
  every funder, or treat simulated allocations as settled real payments.
- Verification: all 49 backend tests passed (34 prior checks plus 15 CSR checks),
  including multi-funder accounting, idempotency, concurrency/rollback, spending
  corrections, withdrawal races, funded completion and report/portfolio accuracy.
  Production frontend build passed. CSR headless browser checks passed for profile,
  matching, evaluation, allocation/withdrawal, monitoring/reports/budget, mobile
  layout and all CSR route guards. The existing NGO/community browser suite also
  passed, explicitly retesting NGO create/adopt and community signup/login/post/apply.
  Desktop/mobile screenshots are in artifacts/csr-browser/.


### Prompt 5 decisions and verification
- Matching is now scored by pure volunteerMatching.js and csrMatching.js functions.
  API orchestration lives in recommendationService.js; each result includes matchScore,
  matchBreakdown and matchReasons. Scores are points, never percentages. Normalize case,
  whitespace and existing signup category labels; duplicate inputs cannot multiply points.
  Ties sort by creation time descending then ID. Score the complete eligible set before
  pagination (default 10, limit capped at 50).
- Volunteer scoring: skill overlap * 3 + interest overlap * 2 + same city 2 +
  availability fit 1 + cause-area overlap * 2. Problems have no structured skills, so
  they receive no inferred skill bonus. Adopted Problems appear once as Projects;
  unfinished unlinked Problems and unfinished Projects remain eligible.
- Availability is a documented heuristic: flexible needs recorded urgency or a valid
  timeline; weekdays/weekends need a matching day within the recorded start/end dates
  using UTC calendar days. Missing/unknown evidence earns zero. No date is guessed.
- CSR scoring: focus overlap * 3 + shared city/state 2 + budget fit 2 (within range)
  or 1 (positive requirement below range or at most 20% above maximum) + verified NGO 1
  + independently 0.5 for more than three previous projects. Compare fundingRequired,
  not funding gap. Only explicit INR ranges are parsed; legacy dollars earn no budget
  points and are never converted. Projects currently record city/area, not state;
  matching uses only recorded city/state data, never area-as-state or NGO address.
- CSR match-projects preserves its request/response envelope. Focus/location/budget
  are scoring preferences, so partial matches remain visible. Explicit category,
  fundingMin/fundingMax, timeline, beneficiary, urgency and verification constraints
  remain discovery filters. Default CSR candidates are unfinished projects with a
  funding gap; includeFullyFunded may broaden this but recommendations omit completed
  projects. Ordinary GET project discovery keeps its prior filter semantics.
- GET /api/users/me/recommended-projects and /skill-matches are community-only;
  GET /api/csr/me/recommended-projects is CSR-only. Both dashboards call their new
  recommendation endpoints. Cards show explanations derived from earned points.
- Project.skillRequests stores skillNeeded, positive hoursNeeded, description,
  open/filled status and createdAt. Only the owner NGO may post requests on unfinished
  projects. Skill matches use case-insensitive partial profile-skill matching and
  exclude filled requests/completed projects. Push notifications remain Prompt 7.
- Team retains legacy name/status and adds unique projectId, members, tasks, embedded
  messages, meetingSchedule and timestamps. Project.teamId is set with first acceptance;
  no new Team is created for a project with zero accepted volunteers. The NGO has
  implicit owner access and is not automatically counted as a volunteer.
- Team.members is authoritative; membership changes transactionally mirror its userIds
  into Project.teamMembers. Startup prepareTeams installs a partial unique projectId
  index and resumably backfills only legacy nonempty teamMembers projects lacking teamId.
  Existing Team members win over stale mirrored arrays; placeholder Teams survive.
  Requires a replica set, like previous NGO/funding operations. Conflicts are not deleted.
- All existing NGO acceptance routes and the new
  POST /api/projects/:id/accept-applicant/:applicationId share one strict transaction.
  Project locking serializes first acceptance, membership edits and funding operations.
  Concurrent acceptances create one Team and preserve both volunteers. Defaults are
  Volunteer or Skill Contributor according to application type; retries are idempotent.
- Removing a member is NGO-only, with frontend confirmation. It unassigns tasks, retains
  message/application history and immediately denies subsequent workspace API requests.
  Retrying an already-accepted application cannot undo removal. Empty established Teams
  remain for history. Role edits and meeting scheduling allow owner NGO or Coordinator;
  current members/owner may create/edit/delete tasks and post messages. Task assignment
  requires current membership. Arbitrary CSR funders and unrelated NGOs have no access.
- Every Team route checks current membership/ownership. Member details include public
  name/photo/city and skills/availability/bio, not email, password hashes or tokens.
  Message sender/time are server-controlled. Validation bounds strings, hours, statuses,
  IDs and dates; React renders messages as text.
- Messages stay embedded intentionally. Detail/messages endpoints return latest 50 in
  chronological display order, with a timestamp|subdocument-ID cursor to avoid gaps at
  identical timestamps. The requested timestamp-only before parameter is also accepted.
  Database projection returns bounded message pages; sortArray requires MongoDB 5.2+.
  Move messages to a separate indexed collection if volume grows. Prompt 7 can hook
  into committed messages/skill requests; no WebSocket or push delivery is implemented.
- /teams/:id provides members, task columns, conversation and upcoming meetings. Messages
  poll every 12 seconds, catch up across pages after busy intervals, deduplicate and
  preserve reading position; older history loads on demand. Membership/tasks/meetings
  refresh every 12 seconds as well, and denied access stops polling.
- Community /projects/:id and its read/apply APIs complete access to direct NGO projects.
  Adopted-project applications reuse their source Problem target to preserve deduplication.
  My Applications links current members to their workspace; removed members lose the link.
  Existing problem reporting, saving and application actions remain intact.
- Prompt 6 should use Team.members.length for participation. Existing Prompt 4 reports
  remain accurate through the synchronized Project.teamMembers mirror; membership edits
  do not change allocations/spending. Funding remains simulated and separate from
  volunteer Contribution records. No real payments, notifications or sockets were added.
- Verification: all 64 backend tests passed (49 existing regression checks plus
  15 matching/team checks), including exact weighted ranking, permissions on every
  Team route, concurrent first acceptance, rollback, legacy backfill, member removal,
  task assignment, same-timestamp message cursors and funded participation counts.
  Production frontend build passed. Two isolated logged-in Chrome sessions verified
  skill-request discovery, direct-project apply/NGO acceptance, workspace links,
  tasks/meetings/roles, messages arriving within one polling interval, older history,
  catching up across a 65-message burst, confirmation/removal and access revocation.
  Desktop/mobile screenshots are in artifacts/team-browser/. Existing NGO/community
  and CSR browser suites also passed, including project management, allocations,
  withdrawal, spending attribution, reports and dashboard role guards.


### Prompt 6 decisions and verification
- Contribution now stores projectId and exactly one typed payload: timeContributed,
  skillsContributed, moneyContributed or materialsContributed. Status is confirmed by
  default in the model; API time/skills/money auto-confirm, materials start pending.
  New time/skill logging requires current Team membership; any community user may
  donate money/materials. Client owner/project/status overrides are rejected.
- New submissions use Idempotency-Key (per-user partial unique index and canonical
  payload fingerprint). Same-payload retries return the same record; changed requests
  conflict. Money is simulated INR, validated to two decimals and summed in paise.
  No payment gateway, escrow, receipts for settled payments or real transfers were added.
- Migration preserves old problemId/note/amount and original timestamps. Unknown hours,
  skills, material quantities and ambiguous INR/$ amounts are not inferred. Legacy rows
  are pending/legacyNeedsReview and excluded from confirmed totals until NGO review.
  Original amount/note remain after structured repair. Legacy money confirmation must
  explicitly attest INR. Historical confirmed donations may exceed the current goal;
  excess is shown and additional donations/allocations are rejected at the unified gap.
- migrateContributionRecords is idempotent and links historical problem contributions
  through linkedProjectId. Unadopted records remain intact and visible in personal history;
  adoption invokes the same linkage helper. Old problem contribute routes adapt linked
  Projects to the validated service; unadopted/new incomplete submissions get clear errors.
  New contribution records always reference a Project. Startup prepareImpact installs
  additive indexes, migrates records and recalculates/backfills per Project transaction.
  scripts/impactMigrationReport.mjs reports unresolved data without editing records.
- contributionAggregates.js is the common confirmed-only calculation layer, re-exported
  through impactCalculations.js. Skill session hours count once; per-skill breakdown
  divides a multi-skill session equally. Material names normalize case/whitespace;
  quantities aggregate per item, material count means distinct item kinds, and estimated
  value is separate from money raised. Unlinked/pending/rejected/review rows never count.
- aggregateProjectFunding returns fromVolunteers/fromCSR/total. Project.fundingReceived
  is their sum; fundedBy remains CSR IDs only. CSR profile/portfolio figures remain
  company-specific allocations, not volunteer money. Both funding paths lock Project
  and check the unified gap, preventing concurrent volunteer/CSR overfunding.
- Spending remains the latest cumulative NGO resource snapshot, never the sum of them.
  Existing CSR allocations absorb spending oldest first; the remaining expense is
  attributed to the confirmed volunteer pool, capped at its total. Any excess remains
  unattributed. This preserves the prior CSR attribution rule without assigning full
  project spending to each donor. Withdrawal keeps existing CSR eligibility rules.
- Resources uses the shared read-only funding breakdown plus a separate receipt-backed
  expense form. Raised money cannot imply spending, so the expense API/history remains.
  Donated material quantities are shown separately from manually tracked inventory;
  neither is blindly added to the other. No separate expense ledger was introduced.
- Project.progressPercentage is the rounded (two-decimal) completed-milestone ratio,
  zero when none exist. Creation/edit/status paths maintain it; migration backfills it.
  Completed status alone does not fabricate 100% progress. Shared progress reads use
  a transaction for consistent funding/contribution totals during concurrent changes.
- Existing Project.volunteerHours is preserved as legacy NGO-recorded evidence.
  contributionHours contains confirmed time + skill hours; contributionTracking is set
  once structured hours are confirmed. NGO stats prefer structured hours on those projects
  and retain old manual totals on untouched legacy projects, without adding overlapping
  sources. Manual hours become read-only once structured tracking is active. ImpactRecord
  hours always come strictly from confirmed Contributions, even for historical backfills.
- Existing recalculateNgoStats lives in ngoStats.js and is re-exported by ngoService;
  its logic was reused, not copied. Snapshot generation calls shared contribution/funding
  reconciliation and existing NGO/CSR stat functions in the completion transaction.
  Project locks and profile writes serialize competing completion/confirmation/funding
  operations. All complete/status/general-update completion paths generate a snapshot.
- ImpactRecord has one projectId under a partial unique index. It copies beneficiary,
  confirmed hour/material/funding figures, original funding goal, spending, Team.members.length, organization
  credits, photo arrays, completed milestones, title/category/location/description and
  NGO-written outcomes. New completions set Project.completedAt. Existing placeholders
  remain intact. Repeated/concurrent completion returns the same snapshot.
- Historical completed Projects missing a snapshot get reconstructed=true, with actual
  snapshot creation time and unknown original completedAt left null. Their membership
  and photos reflect available backfill data, explicitly disclosed in the story. Never
  represent a reconstruction as verified completion-time history or invent prior hours.
- Snapshots never change on later Project/team/photo/outcome edits. Completed projects
  reject new submissions, but pending pre-completion records can still be reviewed.
  Late confirmations update current totals/profile statistics, not the completion story.
  Pending-to-final decisions are idempotent; conflicting repeated decisions return409.
- /api/projects/:id/progress-summary is the shared identity-free authenticated endpoint
  for all roles; ProgressSummary uses it in community Project/adopted-Problem details,
  NGO overview/resources and CSR evaluation/monitoring/reports. It shows required,
  collected, spent, remaining, funding sources, gap/excess, hours/materials and milestones.
- /api/projects/:id/contributions is private to owner NGO/current Team members; donors
  outside the team can read only their own timeline via /api/users/me/impact. List pages
  expose display names, not email/auth data. Confirmation is owner NGO only. Impact
  Stories show NGO/CSR credits and aggregates, never individual donation identities.
- /impact-stories and /impact-stories/:projectId are authenticated cross-role pages,
  backed by paginated/filterable /api/impact-records and project impact-record endpoints.
  Stories present problem, people, work, resources, result, evidence and impact. They
  label simulated funds and historical reconstructions; before/after photos are copied
  evidence, not generated claims. An unfinished project has no public impact record.
- My Impact uses confirmed personal totals plus a paginated dated timeline including
  pending/rejected/legacy entries. Community dashboard replaces application-derived
  hours and fabricated XP/ranks with recorded contribution figures. Existing role
  dashboards, matching, applications, team messaging and funding controls remain.
- Prompt 7 can trigger notifications after contribution confirmation/completion commits.
  Prompt 8 should reuse these shared aggregates, never add stable snapshots to live
  contribution totals. New verification badges, report exports and payments stay deferred.
- Verification: all 78 backend tests passed (64 existing plus 14 Prompt 6 checks).
  The targeted impact suite also passed after the final required-funding snapshot field.
  Production build passed. Impact browser checks passed for four typed forms, pending
  material confirmation, expense receipt entry, outcomes/completion, personal timeline,
  identical summaries across roles, unified CSR report, and desktop/mobile stories.
  Existing NGO/community, CSR and two-session team browser suites passed. Screenshots
  are in artifacts/impact-browser/, with earlier suites in their existing directories.
  Browser review found and fixed a refresh ordering issue after material confirmation.
  Tests use isolated replica sets and temporary browser sessions, not live records.
