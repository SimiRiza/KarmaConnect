# Implementation Plan - Prompt 3: NGO Dashboard

Status: Approved by the user and implemented. See gemini.md for final decisions and validation results.

## Objective and boundaries
Complete the NGO dashboard within the existing React/Vite/Tailwind and Express/Mongoose application. Preserve authentication, existing data, Community User features, and existing NGO work. No CSR dashboard, matching algorithm, chat, notifications, payment integration, or admin verification tools in this prompt.

Read before planning: gemini.md and brandguidelines.md in the project root.

## Findings from the existing application
- Project, Problem linking fields, NGO statistics/team fields, NGO services/controllers/routes, six NGO pages, and the requested reusable components already exist in partial form. Extend and repair these files rather than recreate them.
- App.jsx still mounts the placeholder NGO dashboard and does not register the other NGO pages. Its NGO guard and the backend currently also permit admin.
- Several existing API paths/methods differ from the requested contract.
- Adoption uses a transaction helper that can fall back to nontransactional writes; that cannot guarantee atomic adoption.
- The direct completion endpoint can bypass pipeline order. Direct creation accepts caller-provided status.
- Resource updates read receiptNote but neither require nor store it. Photo routes lack multipart upload middleware.
- Impact statistics currently invent 12 volunteer hours per team member; there is no actual hours source.
- Discovery logic is duplicated, resource filtering is missing, and urgency sorting needs correction.
- Existing auth and community API tests provide a regression starting point. At planning time, Prompt 3 was unchecked in gemini.md.

## 1. Data and business rules
- Retain all existing model fields and add only missing fields/defaults/validation. Complete Project fields, NGOProfile photos and team editing, and persistent resource note/receipt references.
- Keep Project.ngoId immutable and server-assigned. Direct creation forces sourceProblemId=null and initial status=adopted. Received funding and accepted team membership remain server-controlled.
- Maintain Problem.adoptedByNgoId and Problem.linkedProjectId alongside Project.sourceProblemId. Enforce one project per non-null source problem with a partial unique index after checking existing records for conflicts; never silently discard records.
- Preserve community Application records. Support problem-linked and project-linked applicants; adjust uniqueness with partial indexes if required so null problem IDs do not prevent applications to distinct projects. Require a valid target and preserve duplicate prevention.
- Use one sequential status service for PUT updates, PATCH status, and completion. Allow only the same status or the next step: reported -> adopted -> team_forming -> funding_needed -> in_progress -> completed.
- Completion requires in_progress, a persisted after-photo, and a positive beneficiary count. Repeated completion is idempotent. Synchronize linked Problem status and NGO statistics transactionally.
- Recalculate impact in a dedicated aggregation service. Add a nonnegative, explicitly recorded Project.volunteerHours total (default 0) editable in project management, and sum completed-project totals. Do not estimate hours from team size; detailed time logs remain future work.
- Prevent edits to completed impact inputs from leaving aggregate statistics stale: recompute in the same transaction when those inputs change.

## 2. Transactions and permissions
- Add strict transaction behavior for NGO operations without changing existing signup behavior. Adoption must fail clearly on unsupported standalone MongoDB, never fall back to partial writes.
- Within adoption, conditionally claim a reported/unlinked problem, create its project, and save both references in one transaction. Return 409 for a conflicting adoption. Concurrent adopters must produce exactly one project.
- Require authenticate + authorize('ngo') for all NGO endpoints and allowedRoles=['ngo'] for all NGO pages.
- Check ownership before reading private project data, processing uploads, reviewing applications, or mutating resources. Return 403 for another NGO's project and 404 for missing records.
- Profile writes use explicit allowed fields; verification status and aggregate stats cannot be self-assigned.
- Proposed verification behavior: pending/rejected NGOs may view their dashboard, discover problems, and edit their profile; adopting and creating managed projects require a verified NGOProfile. Display a clear explanation and test all verification states. This interprets the request's opening scope of verified NGO accounts while keeping onboarding usable.
- Accept/reject and team membership updates run atomically. Use deduplicated membership and define pending-only review with same-decision retries allowed, avoiding accepted-then-rejected membership inconsistencies.

## 3. API contract and shared infrastructure
Implement the exact requested API contract and update the client service to use it. Preserve existing aliases where useful to avoid breaking existing callers.

| Method | Route |
| --- | --- |
| GET, PUT | /api/ngo/me/profile |
| GET | /api/ngo/problems |
| POST | /api/ngo/problems/:id/adopt |
| GET, POST | /api/ngo/projects |
| GET, PUT | /api/ngo/projects/:id |
| PATCH | /api/ngo/projects/:id/status |
| GET | /api/ngo/projects/:id/applicants |
| PATCH | /api/ngo/applications/:id |
| PATCH | /api/ngo/projects/:id/resources |
| POST | /api/ngo/projects/:id/photos |
| PATCH | /api/ngo/projects/:id/complete |
| GET | /api/ngo/dashboard-summary |

- Extract shared discovery filtering/pagination/sanitization from the community route. Support location, category, urgency, resources needed, and existing search/status behavior; NGO status is always reported and unlinked. Use literal escaped search, bounded pagination, and numeric urgency ordering before pagination. Preserve coordinate privacy.
- Extract and reuse multer disk storage with existing image limits and a swappable cloud-storage comment. Accept multipart project photos by before/progress/after category, validate inputs, and clean up files on rejected uploads.
- Require a nonblank note or receipt reference for resource updates and persist it with the update. Validate finite nonnegative values and known material IDs. General project edits must not bypass tracked received-quantity/spending updates.
- Show required, collected, spent, remaining balance, and funding shortfall distinctly. Funding received stays a stored field for Prompt 6; do not simulate incoming money.
- Use a project aggregation with facets/lookups where appropriate for dashboard counts and pending application previews; avoid repeated per-project queries and duplicate application counts. Nearby means the NGO's configured city/served locations; show an explicit all-locations fallback when neither is set.
- Validate IDs, enums, numeric fields, array structures, dates, timeline order, and URL fields server-side. Keep controllers thin and response/error shapes consistent.

## 4. Frontend completion
Wire existing pages into App.jsx and NGO navigation, preserving other role routes and authentication behavior.

- /ngo/dashboard: five summary cards, top-level impact totals, nearby unadopted problems with adoption confirmation, active project pipelines, and inline pending application review.
- /ngo/profile: about, cause/location chips, contact details, photos, editable team cards, and read-only verification badge/explanation.
- /ngo/discover-problems: consistent ProblemCard/filter patterns, resources filter, pagination, loading/error/empty states, and adoption confirmation modal.
- /ngo/projects/new: complete project form including beneficiaries, skills, volunteers, repeatable materials and milestones, location, and timeline. Support source-problem state prefill. Submit adoption through the transactional adopt endpoint, never create a separate direct project for that path. Quick adoption remains available with defaults.
- /ngo/projects: owned-project cards, status filtering, pipeline, funding transparency, and volunteer/application counts.
- /ngo/projects/:id: full details and reusable edit form; valid next-step status control; Applicants, Team, Resources, and Photos tabs; quantity/spending updates with required note; multipart galleries; completion disabled with a visible explanation until requirements are met.
- Reuse and complete ProjectCard, StatusPipeline, FundingProgressBar, ApplicantCard, RepeatableFieldList, VerificationBadge, SkillsChipInput, and existing community patterns.
- Match existing green/teal, coral actions, warm backgrounds, and status colors. Adopted uses teal consistently. Include accessible labels, keyboard-operable dialogs/tabs, readable text, responsive layouts, and clear save/failure feedback.
- Team tab lists accepted volunteers; full team workspace remains Prompt 5.

## 5. Verification and acceptance checks
Use an isolated MongoDB replica set and seeded test accounts, never destructive operations on the user's application database.

- Run existing authentication/community tests and client production build as baseline and after implementation; report baseline failures separately.
- Add focused NGO integration tests for every requested route, validation, read/write role restrictions, verification rules, and cross-NGO ownership using two NGO accounts.
- Test adoption success, competing simultaneous adopters, and deterministic failure between project insertion and Problem update: assert rollback leaves neither an orphan nor a partial link. Where practical, test an interrupted request/connection; transaction rollback and concurrency checks are the primary repeatable proof.
- Test direct creation, protected fields, invalid status jumps through all mutation routes, and completion criteria, linked status synchronization, stats and idempotency.
- Test existing problem applications and project-linked applications, deduplicated team acceptance, and rejection behavior.
- Test resource persistence including note/receipt, invalid numbers/material IDs, upload authorization, and each gallery category.
- Seed known data and assert every dashboard count, nearby filter, and completed impact total matches the underlying records.
- Explicitly retest community signup, login, post-problem, and apply flows; verify save/contribute/profile regressions with the existing suite.
- Build the client and exercise available browser flows: role redirects/direct URLs, adopt-prefill, forms, resource progress, photos, completion, responsive layouts, and loading/error states. If browser tooling or DB startup is unavailable, state that limitation instead of claiming a pass.

## 6. Documentation and delivery
- After implementation and verification, update gemini.md build status and known decisions with reciprocal Problem/Project links, strict transaction requirements, pipeline/completion rules, verification behavior, application/team relationships, the volunteer-hours source, receipt tracking, and Prompt 5/6 extension boundaries.
- Add any necessary local replica-set setup notes to README/.env.example without changing credentials.
- Deliver a concise summary of changes, tests/results, and any remaining limitations. Mark Prompt 3 complete only when its scope is implemented and validated.

## Approval gate
The attached user request explicitly requires: "Generate implementation_plan.md and wait for approval before executing". Approval was received before changing application code. In particular, approval includes the proposed verification behavior and recorded volunteer-hours field described above.
