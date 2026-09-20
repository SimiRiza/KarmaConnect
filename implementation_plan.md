# Implementation Plan - Prompt 5: Matching and Team Formation

Status: Approved by the user, implemented and verified.

## Scope and existing foundations
Read gemini.md and brandguidelines.md. Extend the existing React/Express/Mongoose
application without rebuilding authentication, dashboards, or funding flows.
Prompt 4 is complete with 49 passing backend tests and existing browser suites.
This plan replaces the previous completed Prompt 4 plan; its decisions remain in gemini.md.

Current Team has only name/status; retain those fields while expanding it.
NGO reviewApplication already uses strict transactions and adds accepted users to
Project.teamMembers. Both existing acceptance routes and the requested new alias
will share the expanded service. Community recommendations currently use client-side
scores; CSR matching currently filters categories before sorting.

## 1. Pure matching services
Create server/services/volunteerMatching.js and csrMatching.js, with pure functions
accepting normalized profile data and candidate arrays. Do not mutate inputs or query
MongoDB in scoring functions. Return matchScore, an exact component breakdown, and
reasons derived from the contributions that actually earned points. Stable ties use
creation time then ID. Scores are points, never fabricated percentages.

Volunteer formula: 3 per distinct skill overlap + 2 per interest overlap + 2 for
same city + 1 for availability fit + 2 per cause-area overlap. Normalize whitespace,
case and existing category labels; deduplicate within each scoring dimension.
Use requiredSkills for projects and category for interests/causes; raw Problems
have no structured skill requirements, so do not infer skills from descriptions.
Availability: flexible earns 1 when urgency or valid timeline is recorded;
weekdays/weekends earn 1 when a valid project date interval includes that day type.
Missing or unrecognized evidence earns zero. Explain the heuristic in returned reasons.
Pass any needed reference date into the pure function explicitly.

Candidates include all unfinished Projects and unlinked unfinished Problems.
Represent adopted Problems through their Project once, avoiding duplicate results.
Include target type/ID so cards navigate/apply to the correct existing resource.
Score the full eligible candidate set before taking top N (limit default 10, max 50).

CSR formula: 3 per focus overlap + 2 for same city/state + budget fit (2 within
range, 1 for a positive requirement below the range or up to 20% above its maximum,
otherwise 0) + NGO credibility (1 verified, independently 0.5 for >3 prior projects).
Use fundingRequired as requested, not funding gap. Parse explicit INR ranges only;
legacy dollars/unknown budgets earn no budget points and remain visible unchanged.
User.location provides company location; Project currently has city/area but no
state. Compare city when available, state only when explicitly recorded; never
infer project state from NGO address or area text.

POST match-projects retains its existing request/response envelope and pagination.
Explicit discovery constraints remain supported; focus/location/budget preferences
contribute scores rather than excluding every partial match. Preserve ordinary
GET project discovery filters. Score before pagination, using current NGO profiles.
New CSR recommendations use saved company/user data and the same scoring function.
Remove outdated filter-only dashboard text and fabricated client scores.

## 2. Models and compatibility
Expand Team with projectId, members (userId/role/joinedAt), tasks
(title/description/assignedTo/dueDate/status/createdAt), messages
(senderId/content/sentAt), meetingSchedule (title/dateTime/notes), timestamps.
Keep embedded subdocument IDs. Use a partial unique projectId index so old placeholder
records without a projectId survive. Bound input lengths and validate dates/statuses.
Document future extraction of messages into a paginated collection when volume grows.

Add Project.teamId and skillRequests (skillNeeded/hoursNeeded/description/status/
createdAt) without removing teamMembers or existing fields. Team.members becomes
authoritative; transactionally mirror user IDs into Project.teamMembers on change.
Owning NGO has implicit access and is not automatically counted as a volunteer.

New projects get no Team until first accepted volunteer. Existing projects that
already have accepted members need a compatibility backfill: implement an idempotent
strict-transaction helper and resumable startup backfill for nonempty legacy
teamMembers only. Preserve existing IDs, create one team, deduplicate members, and
never overwrite a pre-existing Team from stale mirrored data. Projects with zero
accepted members remain without teams. Install uniqueness before backfill; conflicting
records fail clearly rather than deleting data.

## 3. Acceptance and membership consistency
Extend the existing NGO acceptance service, preserving its response shape, ownership,
completed-project restrictions and problem-linked application support. Add
POST /api/projects/:id/accept-applicant/:applicationId as an NGO-only alias.
Serialize team creation/membership writes on Project inside strict transactions;
concurrent first acceptances create one team and preserve all accepted members.
Assign Volunteer or Skill Contributor from the actual application contribution type.
Repeated acceptance is idempotent. Removing a member retains application decision
history; retrying that already-accepted application must not silently re-add them.
Unassign their tasks on removal, retain messages, and revoke access immediately.
An empty established Team may remain to preserve workspace history.

## 4. Team API and authorization
Add thin controllers and team service/routes. Every request authenticates and checks
current Team membership or ownership of its Project, including writes and pagination.
Do not grant unrelated NGOs, CSR funders, or admins implicit workspace access.
Populate only appropriate public member profile fields; never tokens, hashes or
private contact fields. Validate task assignees against current membership.

- GET /api/teams/:id: members, tasks, meetings, latest 50 messages and older cursor.
- PATCH /api/teams/:id/members/:userId: owner NGO or Coordinator changes role.
- DELETE /api/teams/:id/members/:userId: owner NGO only, frontend confirmation.
- POST /api/teams/:id/tasks and PATCH/DELETE /tasks/:taskId: member or owner.
- POST /api/teams/:id/meetings: owner or Coordinator only.
- POST /api/teams/:id/messages: member or owner; sender/timestamps server-controlled.
- GET /api/teams/:id/messages?before=...: latest/older bounded pages.

Order messages by sentAt plus subdocument ID; return a composite cursor for reliable
pagination through identical timestamps, while accepting the requested timestamp-only
before parameter. Fetch message slices without returning all historical messages.
Use atomic writes/transactions so concurrent tasks/messages/removals do not lose data
or authorize using stale membership. Render messages as text, not HTML.

## 5. Recommendations and skill request API
- GET /api/users/me/recommended-projects: community-only scored mixed candidates.
- GET /api/csr/me/recommended-projects: CSR-only scored managed Projects.
- POST /api/csr/match-projects: same interface with real scored ordering.
- POST /api/ngo/projects/:id/skill-requests: owning NGO, validated positive hours,
  nonempty skill and description; reject new requests on completed projects.
- GET /api/users/me/skill-matches: open requests on unfinished projects, normalized
  case-insensitive partial skill matching, pagination and explicit matched skill.

No push notifications, sockets or fabricated notification feed. Document skill requests
and message writes as future Prompt 7 integration points.

## 6. Frontend
Keep brand palette, current navigation, loading/error/empty states and role boundaries.
Community dashboard fetches actual recommendations and a distinct Skill Matches
section. Preserve existing problem actions and support Project recommendation links
and the existing project application path; expose workspace links for accepted users.
CSR dashboard uses its new recommendation endpoint; Discover shows actual score reasons.
NGO project management adds a skill-request form/list and replaces Team placeholder
with a workspace link (or existing accept-applicants empty state).

Build MatchScoreBadge, SkillRequestCard, MemberRow, TaskCard, TaskBoard and MessageThread.
Add authenticated /teams/:id with server-enforced team access, separate from dashboard
role guards. Members tab permits NGO/coordinator role edits, NGO removal with explicit
confirmation. Tasks tab supports create/assign/edit/delete/status updates without reload.
Messages tab polls every 12 seconds with cleanup on unmount, deduplication, older-message
loading, preserved reading position and visible retry errors. Stop polling on access
denial. Upcoming meetings and NGO/coordinator scheduling are visible in workspace.
Keep responsive layout, accessible labels/dialogs and usable keyboard focus.

## 7. Verification
Run the existing 49 backend tests and production build as baseline. Use isolated
memory replica sets/browser fixtures, never application data.
- Unit-test exact score components, at least five differently matching candidates,
  normalization, empty profiles, availability evidence, ties, partial budgets and
  independent NGO credibility bonuses. Confirm input arrays are unchanged.
- API-test both recommendation endpoints and CSR matching ordering/reasons/pagination,
  adopted-problem deduplication, preserved discovery filters and role restrictions.
- Test skill request ownership/validation and case-insensitive partial matches.
- Test first/concurrent/repeated acceptances, legacy backfill, rollback, single-team
  uniqueness, removed-member acceptance retries, mirrored IDs and funded reports.
- Test every team route with member, owner, coordinator, unrelated user/NGO/CSR,
  removed member and unauthenticated caller. Test valid assignees and input errors.
- Test task/meeting/message persistence, concurrent writes and same-time cursor paging.
- Browser-test two separate logged-in sessions: accepted member and owning NGO;
  verify posted messages appear within one polling interval, tasks update without
  reload, roles/removal/meetings work, and revoked users lose workspace access.
- Retest NGO project management and CSR allocation/withdrawal/monitoring using existing
  browser suites and full backend regression suite. Update outdated matching-specific
  expectations to the new formula without weakening funding/auth assertions.
- Build frontend; inspect desktop/mobile workspace screenshots and runtime errors.

## 8. Documentation and completion
After implementation/tests, mark Prompt 5 complete in gemini.md and record formulas,
normalization, availability/budget heuristics, Team source of truth, legacy backfill,
permissions, message cursor/polling design and acceptance/removal semantics. Document
Team.members.length as Prompt 6 participation source and Prompt 7 trigger boundaries.
Update README test instructions and this plan with actual verification results.

## Execution status
User approval was received before application implementation. Matching, skill requests,
team formation, workspace and compatibility paths are complete. All 64 backend tests
and the production frontend build passed. Team browser checks passed with two isolated
logged-in sessions, including message polling, older history and 65-message catch-up.
Existing NGO/community and CSR browser suites passed. Desktop/mobile workspace images
are in artifacts/team-browser/. gemini.md marks Prompt 5 complete and records the final
decisions and Prompt 6/7 integration boundaries.
