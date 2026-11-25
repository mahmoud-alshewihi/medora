# Medora engineering report

Honest status. Everything under "Verified" was actually run in the build sandbox (Node 22, Postgres 18, no Docker).

## Verified
- `npm run lint`: 0 errors (1 style warning in postcss.config.mjs).
- `npm run typecheck` (tsc --noEmit): clean.
- `npm test` (Vitest, real Postgres): 6 files, 76/76 pass. Covers concurrent booking (8 racers, 1 wins), DB-level doctor overlap exclusion constraint, status transitions, rescheduling, invoice maths with Decimal, partial/duplicate/idempotent payments, refunds, cash close, FEFO stock and concurrent stock, tenant isolation / IDOR, medical-record access rules, patient-portal isolation, subscription restrictions, plan limits, CSV import/export, and an end-to-end clinical -> invoice -> payment -> report flow.
- `npm run build` (next build): succeeds.
- Migrations apply; seed runs: 3 clinics, 7 branches, 20 doctors, 36 staff, 500 patients, 1000 appointments, 639 invoices, 538 payments. Seed data is generated demo data, labelled as such.
- Smoke test against the production server: login works; role redirects verified (owner -> /admin, doctor blocked from /admin, patient -> /portal, super admin -> /platform and blocked from tenant pages, reception -> /reception).
- Playwright e2e: 21 tests pass (doctor creation, patient edit, CSV import, purchase order + receive, cash close, portal reschedule, notification centre, Arabic titles/nav, calendar views, stock receive, prescription print access, portal booking and cancelling by a patient, refund via UI, public pages, dashboard/patients, role redirect, record payment, add expense, add staff + save settings, reports page, and a doctor consultation: start, save notes, prescribe, complete, with the invoice and prescription confirmed in the DB) using the sandbox's Chrome.
- Bug found by tests and fixed: code inside a Prisma transaction used the global client and starved the connection pool under concurrent booking.

## Built
Schema (~60 models) and migrations; RBAC matrix; Better Auth sessions; tenant scoping on every query; appointments, queue, consultations, prescriptions, labs, follow-ups; billing, payments, refunds, cash register, expenses; inventory (batches, expiry, transfers, purchase orders); notifications with truthful delivery status; reports and CSV export; platform admin (plans, suspension); audit log; rate limiting; CSRF origin check; upload validation. Full REST API under /api. UI: public site, clinic pages, booking wizard, auth pages, admin dashboard with Recharts, patients list and profile, appointments list, invoices list, inventory list, reception live queue (polling), doctor day view, patient portal overview, platform clinics list. English and Arabic dictionary with RTL, dark mode toggle.

## NOT finished (do not treat as done)
- Reports page is basic (summary and appointment cards, doctor and branch tables, CSV export link; no charts or previous-period comparison in the UI). Expenses, staff and settings pages are real ( staff form covers non-doctor roles only, doctor creation is API-only); the data and actions exist only through the API.
- No interactive UI yet for: stock transfer/adjust (API only), printable invoice page, /verify-email page. Cash close, purchase orders, patient edit/import, portal reschedule, notification centre and printable prescription now have UI (see M10 to M13). Remaining API-only items are covered by service-level tests, not UI tests.
- Arabic coverage is partial; many authenticated screens are English only.
- Dockerfile, docker-compose.yml and the GitHub Actions workflow are UNTESTED (no Docker or CI runner here).
- `npm start` uses `next start` with a standalone build config; it works but Next warns. Use `node .next/standalone/server.js` in containers after copying static assets.
- Rate limiting is in-memory (single instance only). Email only sends if RESEND_API_KEY is set. Email verification is not enforced by default (EMAIL_VERIFICATION_REQUIRED=false). No online payments: offline payment recording only. Real-time features use polling, not websockets.
- No load, accessibility or cross-browser testing was run. Playwright ran only in one Chrome.
- Not deployed anywhere.

## Note on the e2e suite
The e2e tests change the dev database (payments, expenses, staff, consultations, bookings) and the consultation test needs an unconsumed PENDING/CONFIRMED appointment, so re-seed (`npm run db:seed`) before running them repeatedly.

## Design pass (M10)
Fixed the page font (it rendered in a serif fallback), added a nav with icons and an active state, stacked form labels above inputs, clinic-timezone times instead of UTC, patient names on invoices, status badges, a day/week/month appointment calendar, and a printable prescription page. Checked visually from screenshots of: dashboard, patients, billing, appointments (week, month), inventory, patient portal, booking wizard, landing page. Not visually checked: dark mode after this pass, Arabic/RTL layout after this pass, mobile widths.

## M11 additions (verified this run)
- Notification centre (/notifications), Arabic page titles and table headers (phrase map), mobile header fix, dark-mode chart colour.
- Sign-in rate limit is configurable (AUTH_SIGNIN_MAX, default 10/min); e2e sets 200 because the suite logs in many times. An earlier e2e failure was this limit, not a stock bug.
- Run results: tsc clean; eslint 0 errors, 2 warnings (unused import); vitest 76/76; Playwright 15/15.

## M12 additions (verified this run)
- Admin UI: add-doctor form (specialty, fee, commission, slot, working days), patient edit form, patient CSV import, purchase orders (create, list, receive), cash register close, portal reschedule.
- Playwright 21/21 on a freshly seeded DB; tsc clean. Cash-close can only run once per day, so reruns on the same DB accept the "already closed" message, and a closed register blocks payments until re-seed (correct app behaviour, but e2e needs a fresh seed).
- Not done: Arabic on authenticated form labels/buttons/badges (titles, nav and table headers are translated), purchase orders are single-line in the UI, Docker/compose/CI still untested here, vitest 76/76 re-run after M12.

## M13 additions (verified this run)
- Arabic now covers form labels, buttons, select options, status/role badges and the inventory summary line on authenticated screens, through a <T> component and the phrase map (src/lib/i18n/phrases.ts). Phrases not in the map, and server messages such as "Saved." or "Stock received", stay English.
- Checked by screenshot: Arabic inventory and staff, mobile portal, dark billing.
- Runs: tsc clean; Playwright 21/21 on a full run before the last small edit (stock-form button, inventory summary), then the stock, Arabic and purchase-order tests re-run and pass (3/3) after it; the full suite was not repeated after that edit.
- Still not done: Arabic for error/success messages and placeholders, Docker/compose/CI untested here, nothing deployed by me.

## M14 final status (verified this run)
- Arabic now also covers success/error messages (known phrases and common server errors), the patient search placeholder, search/export buttons and gender cells. Dynamic messages (for example the cash-close result with amounts) and any server error not in the phrase map stay English. Public-site copy outside the dict and PDFs/CSV exports are not translated.
- Final runs on a freshly seeded DB: tsc clean; eslint 0 errors, 2 warnings (unused imports); vitest 76/76; Playwright 21/21 (no skips), run after the last code edit.
- Dockerfile, docker-compose.yml and CI workflow: YAML parses and scripts referenced exist; NOT run, because Docker is not available in the build sandbox. CI does not run Playwright.
- Known limitations: e2e needs a fresh seed (closed cash register blocks payments for the day); purchase orders in the UI have one line per order; no online payment gateway (offline payment recording only), email sends only when RESEND_API_KEY is set, no SMS; load/security testing not performed; accessibility checked only by screenshots and role-based test selectors, no automated audit.
