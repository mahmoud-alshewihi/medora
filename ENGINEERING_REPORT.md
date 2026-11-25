# Medora engineering report

Honest status. Everything under "Verified" was actually run in the build sandbox (Node 22, Postgres 18, no Docker).

## Verified
- `npm run lint`: 0 errors (1 style warning in postcss.config.mjs).
- `npm run typecheck` (tsc --noEmit): clean.
- `npm test` (Vitest, real Postgres): 6 files, 76/76 pass. Covers concurrent booking (8 racers, 1 wins), DB-level doctor overlap exclusion constraint, status transitions, rescheduling, invoice maths with Decimal, partial/duplicate/idempotent payments, refunds, cash close, FEFO stock and concurrent stock, tenant isolation / IDOR, medical-record access rules, patient-portal isolation, subscription restrictions, plan limits, CSV import/export, and an end-to-end clinical -> invoice -> payment -> report flow.
- `npm run build` (next build): succeeds.
- Migrations apply; seed runs: 3 clinics, 7 branches, 20 doctors, 36 staff, 500 patients, 1000 appointments, 639 invoices, 538 payments. Seed data is generated demo data, labelled as such.
- Smoke test against the production server: login works; role redirects verified (owner -> /admin, doctor blocked from /admin, patient -> /portal, super admin -> /platform and blocked from tenant pages, reception -> /reception).
- Playwright e2e: 7 tests pass (public pages, dashboard/patients, role redirect, record payment, add expense, add staff + save settings, reports page, all through the UI) using the sandbox's Chrome.
- Bug found by tests and fixed: code inside a Prisma transaction used the global client and starved the connection pool under concurrent booking.

## Built
Schema (~60 models) and migrations; RBAC matrix; Better Auth sessions; tenant scoping on every query; appointments, queue, consultations, prescriptions, labs, follow-ups; billing, payments, refunds, cash register, expenses; inventory (batches, expiry, transfers, purchase orders); notifications with truthful delivery status; reports and CSV export; platform admin (plans, suspension); audit log; rate limiting; CSRF origin check; upload validation. Full REST API under /api. UI: public site, clinic pages, booking wizard, auth pages, admin dashboard with Recharts, patients list and profile, appointments list, invoices list, inventory list, reception live queue (polling), doctor day view, patient portal overview, platform clinics list. English and Arabic dictionary with RTL, dark mode toggle.

## NOT finished (do not treat as done)
- Reports page is basic (summary cards, doctor and branch tables, CSV export link; no charts or previous-period comparison in the UI). Expenses, staff and settings pages are real ( staff form covers non-doctor roles only, doctor creation is API-only); the data and actions exist only through the API.
- No interactive UI for: consultation screen, prescriptions/labs entry, refunds, cash close, stock adjust/transfer, purchase orders, appointment calendar (day/week/month grid; only a 7-day list), patient edit/import forms, portal booking/cancel/reschedule, notification centre page, printable prescription/invoice pages, /verify-email page. These work via API and are covered by service-level tests, not UI tests.
- Arabic coverage is partial; many authenticated screens are English only.
- Dockerfile, docker-compose.yml and the GitHub Actions workflow are UNTESTED (no Docker or CI runner here).
- `npm start` uses `next start` with a standalone build config; it works but Next warns. Use `node .next/standalone/server.js` in containers after copying static assets.
- Rate limiting is in-memory (single instance only). Email only sends if RESEND_API_KEY is set. Email verification is not enforced by default (EMAIL_VERIFICATION_REQUIRED=false). No online payments: offline payment recording only. Real-time features use polling, not websockets.
- No load, accessibility or cross-browser testing was run. Playwright ran only in one Chrome.
- Not deployed anywhere.
