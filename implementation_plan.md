# Implementation Plan - Prompt 4: CSR Manager Dashboard

Status: Approved by the user, implemented and verified. See gemini.md for final decisions.

## Objective
Extend KarmaConnect with the complete csr_manager experience for discovering,
evaluating, funding and monitoring NGO-managed Projects. Preserve authentication,
existing records, the Community User dashboard and the NGO dashboard. Funding is
explicitly simulated; no payment gateway, real matching algorithm, chat,
notifications or admin verification tools are included.

Read before planning: root gemini.md and brandguidelines.md. Implementation will
reuse the existing React/Router/Tailwind stack, service/controller patterns,
strictTransaction helper, status pipeline, verification badge and funding display.

## Current project findings
- CSRProfile already contains all requested editable profile fields and a read-only
  verification status. It needs the six aggregate statistics.
- There is no Funding model, CSR API/service or complete CSR page set yet.
  App.jsx currently mounts a placeholder CSR dashboard and also permits admin;
  the new /csr routes will allow only csr_manager.
- Project already contains ownership, reciprocal Problem links, material needs,
  milestones, beneficiary estimates, team members, photos and funding totals.
- NGO resource updates store fundingSpent as a cumulative total in each
  resourceUpdates snapshot. Summing these snapshots would double-count spending.
- NGO resource tracking already allows recorded spending before any funding is
  received. Existing amounts and history must survive CSR reconciliation.
- Project has no dedicated urgency, delays/issues, milestone completion timestamps
  or individual photo upload timestamps. Adopted projects can inherit urgency from
  their source Problem; direct projects cannot truthfully claim an urgency.
- Existing signup budgetRange values are strings with USD labels; project funding
  uses INR. Existing focus-area labels also differ from Project category enum values.
- The current baseline has 34 backend tests and a reusable headless browser check
  covering NGO and community workflows. No new charting dependency is needed.

## 1. Funding and reporting decisions proposed for approval

### Currency and budget display
- Treat new simulated allocations as INR, matching existing Project funding fields.
  Validate positive finite amounts with at most two decimals; calculate in integer
  paise internally and persist the requested Number fields in rupees.
- Preserve CSRProfile.budgetRange as a string. Offer explicit INR ranges in the new
  CSR profile editor while retaining a current legacy value until the user edits it.
- Do not silently convert a saved dollar range into INR. Recommendations use saved
  numeric budget limits only when the range is explicitly interpretable as INR;
  otherwise apply focus areas and explain that the budget filter is not set.
- The dashboard shows the configured budget range, rather than inventing an exact
  total company budget. The budget page shows allocated, spent and remaining
  allocation balance. Exact annual company budget is not present in the schema.

### Single funding reconciliation service
- Create recalculateProjectFunding(projectId, session), called by all Funding
  mutations and by NGO resource/status/completion updates that affect funded projects.
- Sum non-withdrawn Funding.amountAllocated into Project.fundingReceived.
  Withdrawn records remain as history and contribute zero to fundingReceived,
  fundedBy and current portfolio totals. fundedBy contains distinct active funders.
- Preserve NGO spending as the source of truth: use the latest cumulative
  resourceUpdates fundingSpent snapshot, or the existing Project.fundingSpent when
  there is no history. Never sum cumulative snapshots or erase historical spending.
- Attribute this recorded total to non-withdrawn allocations oldest first, with
  allocationDate and _id as a deterministic order. Cap each allocation's
  amountSpentSoFar at its amountAllocated. Example: allocations of INR 100 and
  INR 200 with INR 150 spent produce spent shares of INR 100 and INR 50.
- If spending exceeds current CSR allocations, retain Project.fundingSpent and show
  the difference as unattributed project spending. It does not inflate any CSR's
  amount spent. This preserves the NGO workflow and provides a clear reconciliation
  boundary for volunteer contributions in Prompt 6. Later allocations may cover
  previously unattributed spending under the same oldest-first rule.
- Updating/correcting the NGO's cumulative spending total, with its required note,
  recalculates attribution and every affected CSR profile in the same transaction.
- Allocation statuses derive from project state and attributed spend: completed
  when the project completes; otherwise in_progress when the project is in_progress
  or the allocation has spending; otherwise allocated. Withdrawn is terminal.
  A same-request retry of a successful withdrawal returns the withdrawn record.
- Withdrawal requires allocated status and zero attributed spending. It cannot
  race with spending or completion to remove funds already committed by those rules.

### Ownership, transactions and accurate aggregates
- CSR users cannot create, edit, adopt or move the status of any Project/Problem.
  Funding services are the only CSR path that updates derived Project funding fields.
- Browsing/evaluation is available to csr_manager accounts as requested. Do not add
  a new CSR verification gate to simulated funding; show verification read-only.
- Fundings and portfolio/report data are scoped to the requesting CSR. Reports and
  monitoring require a non-withdrawn allocation to that project; an own withdrawn
  record remains visible in funding history. Return 403 for other users' fundings.
- Use strict replica-set transactions for allocation, withdrawal and reconciliation.
  Serialize on the Project before computing totals, and on affected CSRProfile
  records in stable order, to avoid lost updates across concurrent operations.
- Add a client-generated idempotency key to funding requests and a compound unique
  index scoped to csrUserId. Network retries must not allocate twice; genuinely
  separate allocations to the same project remain supported.
- Reject new allocations to completed projects and amounts exceeding the current
  funding gap. Recheck the gap inside the transaction so simultaneous funders cannot
  overallocate. Do not change existing project status automatically when funding arrives.
- CSR totals count distinct non-withdrawn funded projects/NGOs, not Funding rows.
  Count beneficiaries only for completed projects (using the existing completion
  beneficiary count). Show ongoing project beneficiaries as estimates separately.
  Sum teamMembers.length once per funded project as requested; label this as
  volunteer participation across projects, not globally unique volunteers.

## 2. Model and service extensions
- Add server/models/Funding.js with csrUserId, projectId, amountAllocated,
  amountSpentSoFar, allocationDate, status, notes and timestamps. Add the internal
  idempotency key and indexes for ownership/status/project lookups.
- Extend Project with fundedBy only; retain existing fields and data. Protect
  fundedBy, fundingReceived and allocation-level spending from arbitrary client edits.
- Extend CSRProfile with totalBudgetAllocated, totalAmountSpent, activeProjectsCount,
  completedProjectsCount, totalBeneficiariesReached and totalNgosPartnered, defaulting
  to zero. Profile PUT must not accept these totals or verificationStatus.
- Add separate funding reconciliation, CSR statistics, CSR discovery and reporting
  services. Controllers remain thin and reuse existing error/validation conventions.
- Integrate funded-project reconciliation into NGO resource updates, status changes,
  completion and edits to completed beneficiary counts. Keep the no-Funding NGO
  behavior and all existing completion/ownership/receipt rules intact.
- Preserve the existing community Contribution model and amounts. Do not count them
  again as CSR funds. Clearly document Prompt 6's future unified reconciliation work.
- Add indexes without deleting records or rebuilding unrelated indexes.

## 3. API implementation
Every route below uses authenticate + authorize('csr_manager'). Register static
reports/portfolio before the parameterized report route.

| Method | Route | Behavior |
| --- | --- | --- |
| GET, PUT | /api/csr/me/profile | Own profile; validated editable fields only |
| GET | /api/csr/projects | Paginated NGO-managed Project discovery |
| GET | /api/csr/projects/:id | Evaluation with curated NGO credibility and evidence |
| POST | /api/csr/match-projects | Temporary filtered/sorted project matching |
| POST | /api/csr/projects/:id/fund | Simulated allocation, idempotency and recalculation |
| GET | /api/csr/fundings | Own records, with status filter and project summaries |
| GET | /api/csr/fundings/:id | Own funding detail |
| PATCH | /api/csr/fundings/:id/withdraw | Guarded withdrawal and recalculation |
| GET | /api/csr/projects/:id/progress | Curated monitoring for own funded project |
| GET | /api/csr/reports/portfolio | Aggregate own portfolio report |
| GET | /api/csr/reports/:projectId | Structured report for own funded project |
| GET | /api/csr/dashboard-summary | Accurate aggregate totals and dashboard sections |

### Discovery and temporary matching
- Browse Projects with a managing NGO, never raw Problems. Default to unfinished
  projects with fundingRequired > fundingReceived. Include-fully-funded toggle
  broadens discovery; completed projects may be evaluated but cannot receive funding.
- Support category/cause, city/area, fundingRequired min/max, NGO verification,
  beneficiaries min/max, urgency and duration filters, with bounded pagination.
- Join the NGO profile for current verification and track record; avoid exposing
  applicant/contact/private user data, raw coordinates or other CSR funding notes.
- Derive urgency from sourceProblemId where available; display Not specified for
  direct projects and exclude unspecified urgency when an urgency filter is applied.
- Compute duration from startDate/expectedEndDate. Unknown duration is shown as
  unspecified and excluded when a maximum duration is explicitly requested.
- Normalize focus-area labels through an explicit category mapping, supporting both
  enum values and existing signup labels. Reject unmappable inputs with useful
  validation rather than silently pretending to find matches.
- Match on overlapping category, location, fundingRequired budget interval and
  timeline limit, with overlap count then funding gap/creation date as stable sort.
  A project currently has one category, so overlap is usually 0 or 1; do not invent
  a sophisticated score. Comment clearly that Prompt 5 replaces this filter-and-sort.

### Monitoring and reports
- Report both project-wide required/received/spent/remaining totals and this CSR's
  allocated/spent/remaining share with unambiguous labels and INR units.
- Include current NGO verification/track record, timeline, materials (quantity data,
  without invented item prices), milestones, before/progress/after evidence,
  participation counts and a factual outcomes summary derived from project state.
- Flag overdue unfinished milestones and overdue project end dates as derived
  schedule warnings. Existing resource notes remain resource notes, not fabricated
  incident records. Say that no separate issue log is recorded in the current model.
- Recent activity is a view of available evidence and resource update timestamps:
  list completed milestones/photo counts and project last-updated time without
  claiming that each milestone/photo has an event timestamp.
- Reports are structured JSON with generatedAt and simulation labeling. Render a
  presentable UI now; downloadable PDF/export remains Prompt 8.
- Use a shared aggregation pipeline for profile/portfolio/dashboard counts where
  practical, deduplicating projects before computing beneficiaries and participation.

## 4. Frontend pages and reusable components
Replace only the CSR placeholder route; keep Community/NGO pages and guards intact.
Add CSR navigation, role-aware discovery links and all routes beneath a guard with
allowedRoles=['csr_manager'], including a protected /csr/* fallback.

1. /csr/dashboard: configured budget range, allocated/spent/remaining totals,
   projects, NGOs, participation and beneficiary cards; profile-based recommended
   projects; own active funding summaries; honest recent project updates.
2. /csr/profile: editable company/manager/industry/website, focus-area chips and
   budget range; read-only verification explanation. Keep legacy budget values visible.
3. /csr/discover-projects: CSRProjectCard grid, filter sidebar including urgency and
   duration, fully-funded toggle, pagination, and a distinct Best Matches panel.
4. /csr/projects/:id: evaluation details, NGOCredibilityCard, materials and funding
   breakdown, timeline/evidence/skills/beneficiaries, and FundModal.
5. /csr/portfolio: funding/project status views, status filter, allocation history,
   guarded withdrawal and links to monitoring/reports. Group repeated allocations
   clearly so users understand multiple records on the same project.
6. /csr/projects/:id/monitor: milestone checklist, own/project funding summaries,
   photo stages and visible derived schedule warnings.
7. /csr/reports: PortfolioSummaryCard plus funded project list and clean ReportView
   sections with genuine figures, evidence and explicit estimated/reached labels.
8. /csr/budget: totals and a per-project INR table, distinguishing current allocation
   balance from the company's unrecorded exact annual budget. No new chart library.

Build CSRProjectCard, NGOCredibilityCard, FundModal, ReportView and
PortfolioSummaryCard. Reuse StatusPipeline, FundingProgressBar, SkillsChipInput and
VerificationBadge. Give VerificationBadge an optional entity label so the CSR
profile says Verified company while existing NGO uses still say Verified NGO.

FundModal explicitly says this is a simulated allocation and that payment processing
will be added later. Keep an idempotency key through retries, disable duplicate
submissions, validate the amount, and refresh funding gap and portfolio data after
success. Support keyboard navigation, accessible dialogs/labels, responsive tables,
and loading/error/empty/success states. Use the existing brand palette with a
professional, data-forward layout and no invented impact or budget values.

## 5. Validation and acceptance coverage
Before implementation, run the existing 34 tests and frontend build as a baseline.
All write tests and browser fixtures use isolated in-memory replica sets, never the
user's application data.

- Verify authentication/role restrictions on every new endpoint and all CSR direct
  URLs; explicitly prove CSR cannot call NGO create/adopt/edit or community posting.
- Test editable profile fields, blocked self-verification/stat edits and legacy
  budget preservation; reject invalid amounts, filters, URLs and IDs.
- Seed at least three categories, multiple NGO verification states, cities, funding
  gaps, beneficiary counts and timelines; assert browse/match results exactly.
- Fund one project from two CSR accounts and assert aggregate fundingReceived,
  unique fundedBy, per-user ownership and no duplicate counts for repeat allocations.
- Test duplicate-request idempotency, competing allocations near the gap, rollback
  after an injected failure and rejection on unsupported standalone transactions.
- Log NGO spending and assert the exact oldest-first attribution, retained receipt
  history, CSR totals and project spending. Test spending corrections, legacy
  spending with no funding, and a later allocation covering that spending.
- Verify eligible withdrawal, rejection after spending/in_progress/completion,
  ownership, retries and withdrawal races with NGO resource updates.
- Complete funded projects through the existing NGO API and verify Funding statuses,
  NGO/CSR stats and report numbers immediately, including concurrent completions.
- Compare per-project and portfolio reports directly with seeded database state,
  covering multiple allocations/projects/NGOs, withdrawn rows, beneficiary edits,
  empty portfolios and volunteer counts.
- Run all existing auth/community/NGO tests and browser workflows, explicitly
  retaining NGO create/adopt and community signup/login/post/apply.
- Add CSR headless-browser coverage for profile, browse, matching, evaluation,
  simulated funding, portfolio/withdrawal, monitoring, reports, budget and direct
  role-guard checks. Inspect desktop/mobile screenshots and uncaught errors.
- Run the production frontend build and document any actual limitations. Reuse
  the existing browser tooling and dependencies.

## 6. Documentation and delivery
After implementation and verification, update gemini.md's build checklist and known
decisions with Funding, the shared reconciliation service, spending attribution,
withdrawal/concurrency rules, simulation status, currency/legacy budget behavior,
portfolio counting and Prompt 5/6 extension points. Update README setup/test notes.
Mark Prompt 4 complete only once its scope and regression checks are finished.

## Execution status
User approval was received before implementation. All eight CSR pages and requested
API routes are implemented. All 49 backend tests and the production frontend build
passed. CSR and existing NGO/community browser suites passed; screenshots are in
artifacts/csr-browser/ and artifacts/ngo-browser/. gemini.md marks Prompt 4 complete
and records reconciliation rules and future-prompt extension points.
