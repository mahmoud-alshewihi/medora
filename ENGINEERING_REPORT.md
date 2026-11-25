# Medora engineering report

Honest status. Everything under "Verified" was actually run in the build sandbox (Node 22, Postgres 18, no Docker).

## Verified
- `npm run lint`: 0 errors (1 style warning in postcss.config.mjs).
- `npm run typecheck` (tsc --noEmit): clean.
- `npm test` (Vitest, real Postgres): 6 files, 76/76 pass. Covers concurrent booking (8 racers, 1 wins), DB-level doctor overlap exclusion constraint, status transitions, rescheduling, invoice maths with Decimal, partial/duplicate/idempotent payments, refunds, cash close, FEFO stock and concurrent stock, tenant isolation / IDOR, medical-record access rules, patient-portal isolation, subscription restrictions, plan limits, CSV import/export, and an end-to-end clinical -> invoice -> payment -> report flow.
- `npm run build` (next build): succeeds.
- Migrations apply; seed runs: 3 clinics, 7 branches, 20 doctors, 36 staff, 500 patients, 1000 appointments, 639 invoices, 538 payments. Seed data is generated demo data, labelled as such.
- Smoke test against the production server: login works; role redirects verified (owner -> /admin, doctor blocked from /admin, patient -> /portal, super admin -> /platform and blocked from tenant pages, reception -> /reception).
- Playwright e2e: 15 tests pass (notification centre, Arabic titles/nav, calendar views, stock receive, prescription print access, portal booking and cancelling by a patient, refund via UI, public pages, dashboard/patients, role redirect, record payment, add expense, add staff + save settings, reports page, and a doctor consultation: start, save notes, prescribe, complete, with the invoice and prescription confirmed in the DB) using the sandbox's Chrome.
- Bug found by tests and fixed: code inside a Prisma transaction used the global client and starved the connection pool under concurrent booking.

## Built
Schema (~60 models) and migrations; RBAC matrix; Better Auth sessions; tenant scoping on every query; appointments, queue, consultations, prescriptions, labs, follow-ups; billing, payments, refunds, cash register, expenses; inventory (batches, expiry, transfers, purchase orders); notifications with truthful delivery status; reports and CSV export; platform admin (plans, suspension); audit log; rate limiting; CSRF origin check; upload validation. Full REST API under /api. UI: public site, clinic pages, booking wizard, auth pages, admin dashboard with Recharts, patients list and profile, appointments list, invoices list, inventory list, reception live queue (polling), doctor day view, patient portal overview, platform clinics list. English and Arabic dictionary with RTL, dark mode toggle.

## NOT finished (do not treat as done)
- Reports page is basic (summary and appointment cards, doctor and branch tables, CSV export link; no charts or previous-period comparison in the UI). Expenses, staff and settings pages are real ( staff form covers non-doctor roles only, doctor creation is API-only); the data and actions exist only through the API.
- No interactive UI for: cash close, stock transfer/adjust, purchase orders, patient edit/import forms, portal reschedule, notification centre page, printable prescription/invoice pages, /verify-email page. These work via API and are covered by service-level tests, not UI tests.
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
- Still not done: doctor-creation form, patient edit/import UI, portal reschedule, cash-close UI, purchase-order UI, Arabic on authenticated form labels/badges, Docker/compose/CI untested.
