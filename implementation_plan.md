# Implementation Plan — Prompt 2: Community User / Volunteer Dashboard

## Goal
Add the full community-user dashboard experience without disturbing the existing Prompt 1 foundation: authentication, role-based routing, signup/login/logout, password reset flow, and all current schema patterns.

## Scope Guardrails
- Only build the community_user experience for this prompt.
- Do not touch the NGO or CSR signup/profile logic from Prompt 1.
- Do not add NGO/CSR-only routes or data visibility to this role.
- Preserve the existing database schema and auth system as-is, extending only the required models and routes.
- Keep placeholder models and fields clearly documented as “minimal for now” for later prompts.

## Baseline Review
- Confirm existing auth stack remains JWT + refresh-cookie based, in-memory access token, protected routes and role guards.
- Confirm frontend currently uses React Router + AuthContext + RoleProtectedRoute pattern.
- Confirm backend uses Express + Mongoose + middleware validation pattern.

## Planned Workstreams

### 1) Backend model and schema extensions
Update only the models needed for this prompt.

- Problem model
  - Add fields from the spec: postedBy, title, description, category enum, photos, location, urgency, estimatedResourcesNeeded, status, timestamps.
  - Keep geospatial data approximate only; never store exact home address.
  - Add comments noting that this is the minimal version to support discovery and posting for Prompt 2.

- User model
  - Add savedProblems array to support saved projects.
  - Keep all other existing fields and validations unchanged.

- Application model
  - Minimal shape as requested: userId, problemId, contributionType, relevantSkills, note, status, createdAt.
  - Add comment explaining this is intentionally minimal and will be expanded in Prompt 5.

- Contribution model
  - Minimal shape as requested: userId, problemId, type, note, createdAt.
  - Add comment explaining this is an early placeholder for the later contributions/impact tracking work.

- Project / Team / ImpactRecord / Notification
  - Leave as placeholders. Do not redesign them beyond the small enum and minimal contribution shape needed by the front-end flow.

### 2) Backend API routes and controllers
Create the user/community dashboard endpoints under the authenticated + authorize('community_user') pattern.

- Profile endpoints
  - GET /api/users/me/profile
  - PUT /api/users/me/profile
  - Validate skills/interests arrays and max length = 15 each.

- Problem discovery endpoints
  - GET /api/problems
  - GET /api/problems/:id
  - Filter by location (city), category, urgency, status.
  - Support pagination and sorting (newest, most urgent).
  - Do not leak exact coordinates; only city/area can be returned.

- Problem creation endpoint
  - POST /api/problems
  - Validate required title, description, category, photos, location, urgency.
  - Require user to be authenticated and authorized as community_user.

- Photo upload support for problem creation
  - Integrate multer with local disk storage for now.
  - Keep the interface swappable for cloud storage later.
  - Add clear code comments noting the production replacement strategy.

- Apply / join flow
  - POST /api/problems/:id/apply
  - Prevent duplicate applications per user/problem.
  - Minimal Application record creation with status pending.
  - Validate contributionType and user input.

- Applicant listing
  - GET /api/problems/:id/applicants
  - Restrict visibility to the problem poster only for now.

- Contribute flow
  - POST /api/problems/:id/contribute
  - Record a minimal contribution.
  - For money, simulate the flow and clearly document the later payment integration placeholder.

- Impact and saved items
  - GET /api/users/me/impact using a MongoDB aggregation pipeline
  - POST /api/problems/:id/save and DELETE /api/problems/:id/save
  - GET /api/users/me/saved

### 3) Validation and error handling
- Keep controller logic thin and service-based where appropriate.
- Match existing error response patterns from Prompt 1 (consistent success/error shape, validation messages, 400/404/401/403 patterns).
- Ensure all new endpoints validate input server-side and reject unsafe or malformed payloads.

### 4) Frontend pages and role-gated UI
Add the new pages under the existing protected/role-protected routing model.

- Dashboard Home (/dashboard)
  - Welcome card with user’s name
  - Nearby Problems section
  - Recommended for You section
  - My Active Applications
  - My Impact summary
  - Quick action buttons

- Discover page (/discover)
  - Search + filters + pagination
  - Problem cards with photo, location, category, urgency, status
  - Empty state handling

- Problem detail page (/problems/:id)
  - Photo gallery, description, badges, location, status pipeline
  - Apply modal flow
  - Save/unsave action
  - Contribution modal for money/materials
  - Already-applied state handling

- Post a Problem page (/post-problem)
  - Multi-photo upload preview
  - Validation and redirect to detail page on success

- My Profile page (/profile)
  - Editable profile fields with chip inputs for skills, interests, cause areas
  - Save feedback and immediate UI updates

- My Applications page (/my-applications)
  - List of applied problems with status

- My Impact page (/my-impact)
  - Expanded totals and contribution breakdown

- Saved Projects page (/saved)
  - Saved problems list using shared card component

### 5) Reusable UI components
- ProblemCard
- StatusBadge
- UrgencyBadge
- ApplyModal
- ContributeModal
- SkillsChipInput
- PhotoUploadPreview
- EmptyState

Follow the brand palette from brandguidelines.md exactly:
- warm green/teal primary
- coral/orange CTAs
- status colors for Reported, Team Forming, Funding Needed, In Progress, Completed
- warm neutral backgrounds
- mobile-responsive card hierarchy

### 6) Testing and verification
Before claiming completion, verify the required behavior with focused checks:
- auth/signup/login/logout/password reset still work unchanged
- community_user dashboard loads correctly
- new problem appears in Discover immediately
- problem filtering/search narrows results
- duplicate application is prevented
- simulated contribution is reflected in impact totals
- save/unsave updates the saved list
- profile edits persist and reflect without reload
- NGO/CSR-only routes remain unreachable from this role

### 7) Documentation update
- Update gemini.md’s Current build status to mark Prompt 2 complete once implementation is finished.
- Add a short note under Known decisions already made describing the minimal Application and Contribution shapes so later prompts know exactly what they are extending.

## Proposed Execution Order
1. Extend backend models and schema fields.
2. Add routes, validators, and controllers for profile / problems / applications / contributions / saved items.
3. Wire frontend routes and protected pages.
4. Build reusable dashboard components and page layouts.
5. Verify against acceptance criteria and fix regressions.
6. Update project status documentation once verified.

## Risks / Constraints
- Preserve existing Prompt 1 auth flow exactly; do not break refresh token or session behavior.
- Do not implement NGO or CSR features in this prompt.
- Do not over-engineer the matching system, donation gateway, or notification system; keep minimal placeholders clearly commented.

## Approval Gate
This plan is prepared and ready to execute. I am waiting for your approval before starting the actual code implementation.
