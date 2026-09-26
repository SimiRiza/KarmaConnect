# Prompt 8 polish audit

Verified 24 September 2026 with isolated replica sets and temporary Chrome profiles.
No live users were seeded, suspended or created by tests. The existing palette and
participant workflows remain intact.

## Route coverage

`verifyPolishBrowser.mjs` checks delayed loading, injected server failure, successful
Retry, uncaught browser exceptions and 375px overflow on 31 authenticated pages.
It then checks 17 genuinely empty views after clearing only its temporary fixtures.
See `artifacts/admin-browser/polish-check.log` for individual results.

| Routes | Checks |
| --- | --- |
| All six admin pages and `/admin/users/:id` | Loading/error/retry/mobile; empty review queues; all participant roles denied every admin route |
| `/dashboard`, `/discover`, `/my-applications`, `/saved`, `/my-impact` | Loading/error/retry/mobile and empty views |
| `/profile`, `/problems/:id`, `/projects/:id` | Loading/error/retry/mobile; existing profile/application workflows |
| `/notifications`, `/impact-stories`, `/teams/:id` | Loading/error/retry/mobile; empty notification/story lists; polling and membership regression checks |
| `/ngo/dashboard`, `/ngo/discover-problems`, `/ngo/projects` | Loading/error/retry/mobile and empty views |
| `/ngo/profile`, `/ngo/projects/:id` | Loading/error/retry/mobile; edit, applicant, resource, photo and completion workflows |
| `/csr/dashboard`, `/csr/discover-projects`, `/csr/portfolio`, `/csr/reports`, `/csr/budget` | Loading/error/retry/mobile; empty discovery, portfolio, reports and budget views |
| `/csr/profile`, `/csr/projects/:id`, `/csr/projects/:id/monitor` | Loading/error/retry/mobile; allocation and monitoring regressions |
| `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password/:token`, `/verify-email/:token` | Public 375px checks, invalid-token pages, all three participant signup/login flows; backend verification/reset tests |
| `/post-problem`, `/ngo/projects/new` | Existing browser submission, validation and prefill checks; labels associated with controls |
| `/impact-stories/:id` | Existing populated desktop/mobile impact-story and evidence checks; shared error Retry |
| Admin/CSR index and wildcard aliases | Redirects retained; admin subtree guarded before rendering |

## Usability changes

- Saved/application pages now distinguish loading, failure and successful empty
  responses. Discovery prevents stale responses and resets pagination on filters.
- Shared AsyncState, RequestError and EmptyState provide consistent feedback.
  Some existing pages reload on explicit Retry; forms retain entered values until
  that retry/navigation. The application modal keeps input when submission fails.
- Admin forms have associated labels, required notes, inline feedback and disabled
  busy actions. Suspension/reactivation requires confirmation.
- Adjacent labels now target their fields. NGO fields and skills inputs use unique
  IDs. Existing labeled reusable forms remain in place.
- Application dialog checks confirm focus enters, Escape closes it and focus
  returns to the invoking button. Global keyboard focus uses dark teal.
- Admin navigation wraps at 375px, user rows become cards, CSR budget has mobile
  cards, and team tabs wrap. No global overflow hiding was added.
- Shared status/verification badges retain text labels. Evidence uses contextual
  alt text. Admin mobile screenshots were visually inspected.
- Text contrast: white/brand-600 5.29:1; white/accent-500 4.73:1; status badge
  800/100 pairs 6.38:1 to 7.39:1. These are targeted checks, not certification.
- Desktop/mobile admin navigation links to the admin panel. New signup budget
  choices use INR; existing legacy dollar profile values remain preserved.

## Recorded results

- Full backend run: **100 tests passed, 0 failed**, including nine admin tests.
  Concurrent bootstrap/suspension, token revocation, role boundaries, privacy,
  aggregate totals, growth and review history are covered.
- All five previous browser suites passed: NGO/community, CSR, matching/teams,
  contributions/impact and trust/notifications. NGO was rerun after modal/label
  changes and passed again.
- `verifyAdminBrowser.mjs` passed mobile pages, review actions, user access changes
  and every non-admin role denial.
- `verifyPolishBrowser.mjs` passed 31 request-state/mobile and 17 empty-state cases.
- `verifySignupPolishBrowser.mjs` passed NGO/CSR signup/login, public mobile pages
  and application-dialog keyboard checks. Community signup/login/post/apply is
  covered by `verifyNgoBrowser.mjs`.
- Production build passed. Vite emits a main-bundle size advisory above 500 kB.

Logs and screenshots are in `artifacts/admin-browser/` and existing workflow
artifact folders. Tests never populate the live application database.

Payments remain simulated, updates use polling, categories remain enums, and
verification history stores the latest decision. A live admin requires credentials
supplied by the operator; see README for the bootstrap command.
