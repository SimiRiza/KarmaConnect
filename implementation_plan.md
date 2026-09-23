# Implementation Plan - Prompt 6: Contributions and Impact Tracking

Status: Approved by the user, implemented and verified.

## Objective and existing foundations
Read gemini.md and brandguidelines.md. Extend the existing application with structured
contributions, shared project progress and stable completion snapshots. Preserve auth,
all three dashboards, scored matching, teams, simulated CSR funding and existing data.
Prompt 5 is complete: 64 backend tests, production build and three browser suites passed.
The prior completed plan is superseded here; its decisions remain in gemini.md.

Current Contribution stores userId/problemId/type/note/amount, with no hours, item
quantities, status or currency. ImpactRecord is still a metricName/value placeholder.
NGO completion can occur through complete, status and general project-update routes;
all must generate the same snapshot. Existing funding reconciliation counts only CSR
allocations. Resource history contains cumulative spending, never incremental expenses.
Community dashboard currently invents volunteer hours from applications; replace those
impact figures with recorded data as part of this work.

## 1. Model extensions and migration
Expand Contribution with projectId, the four requested typed payloads, status and
existing timestamps. Preserve problemId/note/amount for legacy compatibility; never
rename away or delete stored records. New contributions require a Project and exactly
one nonempty payload matching type. Do not accept userId or arbitrary status from clients.
Keep volunteer Contributions and CSR Funding as distinct models.

Validate finite positive hours/amounts/quantities, bounded text/skill/item arrays and
nonnegative estimated material value. Money is simulated INR, validated to two decimals
and calculated in integer paise. Estimated material value is not money raised.
Use a per-user idempotency key for new submissions, retained by the modal across retries,
so duplicate network requests cannot inflate funding or hours.

Implement an idempotent, resumable migration service and a read-only migration report.
- Link old problemId records through Problem.linkedProjectId when available. Keep
  unresolved historical records intact with explicit linkage/review metadata; exclude
  them from Project totals until linked. Adoption invokes the same linkage helper.
- Preserve original amount/note/timestamps. The old UI accepted an ambiguous INR/$
  amount and stored no currency; do not silently relabel legacy amounts as INR.
- Legacy records with missing hours, skills, item quantities or currency remain marked
  for review and excluded from confirmed numeric totals. Do not infer values from notes
  or turn an application into volunteer hours. Represent them in the user's history.
- The owning NGO can supply missing structured details when reviewing a legacy record,
  explicitly attest INR for an old money amount, and then confirm/reject. Restrict this
  payload repair to flagged legacy records and retain original data for auditability.
- Preserve unresolved pre-adoption records and reattempt linkage on adoption/startup.
  New UI directs contributions to adopted Projects; unadopted Problems explain that
  contribution logging becomes available after adoption. The old contribute endpoint
  remains a compatibility adapter for linked Projects, with clear validation responses
  for missing structured data or an unadopted target, never creating fictional Projects.

Expand ImpactRecord with every requested field: unique projectId, beneficiary/hour/
funding/material totals, completion-time Team member count, NGO/CSR credits, copied photo
arrays, NGO outcomesSummary, completedAt and timestamps. Retain placeholder fields and
use a partial unique projectId index to preserve unrelated old placeholder documents.
Add snapshot title/description/category/location and organization display credits so
story content and filters remain stable when live Project/profile data changes.
Add Project.progressPercentage, outcomesSummary and completedAt for future completions.

Existing completed projects receive a clearly identified historical backfill snapshot
from available confirmed data after migration. Never invent an original completion
instant or completion-time membership: flag reconstructed snapshots, use nullable
unknown completion date and disclose that membership/photos reflect backfill time.
Keep an existing ImpactRecord unchanged on migration reruns.

## 2. Shared calculation services
Create server/services/impactCalculations.js with reusable, directly testable functions.
Accept an optional session so callers can include calculations in their transaction.
Use one shared confirmed-contribution aggregation implementation, not per-route math.

- calculateProjectProgress(projectId): completed milestones / all milestones * 100,
  rounded consistently; zero if no milestones. Save after creation, milestone edits
  and status updates; backfill old projects. Completed status does not invent milestones
  or force 100% when the recorded ratio differs.
- aggregateProjectFunding(projectId): sum confirmed, linked volunteer money plus
  non-withdrawn CSR allocations; return fromVolunteers/fromCSR/total using paise.
- aggregateProjectContributions(projectId): confirmed time hours, skill hours, combined
  hours, money, skill breakdown, material item quantities and material estimated value.
  Normalize item names for aggregation but preserve readable labels. Show item-specific
  quantities; do not imply that unlike items share physical units.
- generateImpactRecord(projectId): create one stable snapshot after completed status,
  reusing the above functions, Team.members.length, Project photos/spending, fundedBy,
  beneficiaries and NGO-written outcomes. Repeated completion returns the original.
- calculateUserImpact(userId): sum that user's confirmed structured contributions,
  distinct linked/completed projects, skills and item quantities. Return a paginated
  dated contribution timeline and separate pending/rejected/legacy-review history.
  Preserve compatible response keys while removing fabricated dashboard hours/impact.

Retain existing manual Project.volunteerHours history separately from contribution
hours. Do not add the two sources: they may describe the same work. Store a derived
contribution-hours total for structured records; existing NGO statistics reuse the
existing recalculateNgoStats function, preferring structured hours for projects using
this system and preserving labelled legacy manual hours for untouched old projects.
ImpactRecord.totalVolunteerHours always uses confirmed Contribution hours only.
Once structured contribution tracking is in use, its hours are read-only in NGO editing;
preserve the original manual value as legacy evidence rather than overwriting it.

## 3. Unified funding without double counting
Extend recalculateProjectFunding as the single transactional reconciliation path.
Project.fundingReceived becomes confirmed volunteer money + active CSR allocations.
Project.fundedBy remains distinct CSR funder IDs only. CSR portfolio totals continue
to count only that company's Funding records; volunteer money is not CSR allocation.

Preserve the approved CSR spending rule: attribute cumulative Project.fundingSpent to
active CSR allocations oldest first, then attribute the remaining project spending to
the volunteer money pool up to its confirmed total. Any excess stays explicitly
unattributed. Expose this breakdown without inventing per-volunteer spending records.
Never sum cumulative resource snapshots or charge full project spending to every funder.

Both new CSR allocations and volunteer money submissions check the unified funding gap
under the same Project transaction lock. Pending confirmation checks the remaining gap
again. Existing migrated records are preserved even if historical totals exceed today's
goal; show excess transparently and prevent additional funding instead of deleting data.
Keep existing CSR withdrawal eligibility and idempotency behavior. Reconcile on donation,
confirmation/rejection, CSR allocation/withdrawal, spending updates and completion.

The request describes replacing manual fundingSpent updates with the funding breakdown.
Funding raised cannot determine money spent. Replace the Resources tab's primary display
with shared read-only totals and retain a clearly separated existing receipt-backed
expense-recording form/API as the source of fundingSpent. Do not remove spending history
or manufacture spending from donations; no new expense ledger is introduced here.
Similarly, show contributed materials separately from existing manual received inventory;
never sum both blindly or assume each donation maps to an existing materialsNeeded row.

## 4. Completion, stable evidence and statistics
Hook every existing completion path into generateImpactRecord within the same strict
transaction as Project/Problem updates, reconciliation and profile recalculation.
Reuse recalculateNgoStats and recalculateCsrStats (through shared reconciliation as
appropriate); refactor their call boundaries to avoid circular service dependencies,
without copying their aggregation math. Keep existing ownership/status/photo/beneficiary
requirements, replica-set requirement and serialization of cross-project profile totals.

Snapshot creation uses a unique projectId and is idempotent under concurrent completion.
Failure at any step rolls back completion and derived writes together. Do not regenerate
photos, totals or volunteer count after later Project/team edits. Live progress/report
figures may change; distinguish current totals from the recorded completion snapshot.

New submissions to completed Projects are rejected. Existing pending contributions may
still be reviewed: confirmed totals and live profile/report data update, while the
completion snapshot explicitly remains as recorded then. A late confirmation never
silently rewrites an Impact Story. Confirmation/rejection is a pending-to-final decision;
same-decision retries are safe and conflicting repeated decisions return a conflict.

## 5. APIs and access control
Keep controllers thin; put validation, access checks and mutations in services.
Register specific progress/contribution/impact routes alongside existing project routes
without weakening community-only detail/apply or NGO-only acceptance guards.

- POST /api/projects/:id/contributions: authenticated community users submit their own
  contribution. Time/skills require current Team membership; money/material support may
  come from any community user. Time/skills/money auto-confirm; materials default pending
  so the NGO can verify delivery. Explain the state in the modal and response.
- GET /api/projects/:id/contributions: bounded pagination, optional status/type filters;
  managing NGO or current Team members only. Return useful display names, not private
  email/contact/auth data. A nonmember donor views only their own history via My Impact.
- PATCH /api/projects/:id/contributions/:contributionId/confirm: managing NGO only;
  explicit confirmed/rejected decision and legacy-repair payload only when applicable.
- GET /api/projects/:id/progress-summary: any authenticated role; one shared identity-free
  response with progress/milestones, confirmed contribution totals, unified funding,
  required/collected/spent/remaining, gap/excess, simulation labels and snapshot link.
- GET /api/projects/:id/impact-record: any authenticated role; completed snapshot or404.
- GET /api/impact-records: authenticated, paginated, category/location filtered completed
  stories only; public organization credits and aggregate figures, no donor identities.
- GET /api/users/me/impact: current community user's complete impact/history only.

Use Project IDs for /impact-stories/:id and link to the project's impact-record endpoint.
New read surfaces remain behind auth for all roles; individual contribution lists have
stricter membership/ownership checks on every request. Do not add notifications yet.

## 6. Frontend and design
Build ProgressSummary, BeforeAfterComparison, ContributionTypeIcon, ImpactStatCallout
and PendingContributionRow, reusing the current React/Tailwind/Router component patterns.

Use the same progress-summary API/component in community Project detail, adopted Problem
detail, NGO overview/resources and CSR evaluation/monitoring/report views. Refresh after
contributions, confirmations, milestone changes and funding/resource actions. Preserve
CSR-specific allocation cards beside the shared project totals.

Expand ContributeModal to all four typed forms with field validation, status explanation,
INR simulation notice, retained retry key and disabled duplicate submit. Keep form values
on errors. Add time/skill logging entry points for members and donation actions for
community users. Show pending submissions as pending, never as confirmed impact.

My Impact gains real hours/money/materials/skills totals and a dated, paginated timeline.
Update community dashboard hours and related inferred impact displays to use recorded
values; remove unsupported derived XP/karma claims rather than inventing an impact metric.
NGO Resources adds pending review rows and legacy-review explanations. Add an NGO-written
outcomes summary to project editing/completion preparation. CSR Reports displays unified
money raised beside the caller's allocation share and the stable completion snapshot.

/impact-stories: authenticated cross-role grid with category/location filters, after
images, beneficiary/hour/funding/material statistics, pagination and empty/error states.
/impact-stories/:id: spacious teal/off-white story layout, large side-by-side before/after
photos, progression photos, prominent stats and the narrative sequence Problem -> People
-> Work -> Resources -> Result -> Evidence -> Impact. Credit managing NGO and CSR companies;
show volunteer count without contributor identities. Use actual uploaded evidence and
NGO text, never fabricated photos/outcomes. Clearly label simulated money and reconstructed
legacy snapshots. Add navigation links without mixing role-specific dashboards.

Support mobile, keyboard navigation, readable contrast, accessible dialogs/images and
loading/error/empty states. No new badges, exports, payment gateway, sockets or push.

## 7. Verification and delivery
Run the current 64 tests and frontend build before changes. Tests/migrations/browser
fixtures use isolated replica sets, never the user's live database.
- Test each typed payload and rejection of mismatched/multiple payloads, invalid numeric
  values, forged owner/status, duplicate retries and unauthorized writes/list reads.
- Test confirmed-only aggregates, skill hours, normalized materials, money precision,
  multi-project personal impact and separation of individual vs CSR figures.
- Test mixed funding, withdrawal, expense corrections, simultaneous volunteer/CSR
  donations near the gap, confirmation races and rollback after injected failures.
- Test migration reruns, linked/unadopted Problems, adoption-time linkage, incomplete
  historical payloads/currency, legacy review and absence of invented quantities.
- Test progress at zero/partial/all milestones and when a milestone is unchecked.
- Test all completion paths, one snapshot under concurrent/repeated completion, stable
  photos/counts/totals after edits/removal/late review, and existing profile functions.
- Test legacy completed-project reconstruction disclosures, story filters/pagination,
  auth and contributor privacy for community, NGO, CSR, unrelated and removed users.
- Assert identical progress-summary data across three authenticated roles.
- Browser-test all four contribution forms, NGO pending review, real My Impact timeline,
  shared totals in all three dashboards, completion and desktop/mobile Impact Stories.
- Rerun existing NGO/community, CSR funding and two-session team workspace browser suites;
  run the full backend suite and production build, inspect screenshots/runtime errors.

After checks pass, update gemini.md's Prompt 6 checkbox and known decisions, README and
this plan with actual verification. Document migration, currency, snapshot semantics,
funding attribution, shared progress APIs and Prompt 7 confirmation/completion hooks.
Prompt 8 platform statistics must reuse these aggregations rather than sum snapshots
and live contributions together.

## Execution status
User approval was received before application implementation. Prompt 6 is complete:
structured contributions, migration/review, unified funding/progress calculations,
immutable completion snapshots and all requested frontend pages/components are built.
All 78 backend tests passed. The 14-test impact suite passed again after the final
snapshot funding-goal field. The production frontend build and all four browser suites
(impact, NGO/community, CSR and team workspace) passed. Desktop/mobile Impact Story
screenshots are in artifacts/impact-browser/. gemini.md and README mark Prompt 6 complete
and record the final data, migration, privacy and future-notification decisions.
