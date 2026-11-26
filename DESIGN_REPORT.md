# Medora UI/UX Redesign - Design Report

v0.14 redesign, November 26, 2026. Scope: full premium redesign of the staff portal, patient portal, public marketing site, auth and print surfaces, with no backend rebuild, no mock data, no removed functionality and no broken tests.

## 1. Design tokens (`src/app/globals.css`, `tailwind.config.ts`)

- Color system: teal primary (hue 178), deep navy secondary, full semantic scale (success/warn/danger/info, each with a soft surface tint), chart palette, all as HSL CSS variables so light and dark themes share components.
- Dark theme is intentional, not inverted: surfaces, borders and shadows re-balanced per theme.
- Radius, shadow (xs-md), and motion tokens (duration-fast, ease-smooth).
- RTL: logical properties (ms/me/ps/pe/start/end) throughout; physical left/right only where direction-independent.
- Typography: tabular numerals (`.tnum`) for money, dates and stats so numbers align in both locales.

## 2. Primitives v2 (`src/components/ui/primitives.tsx`)

Card family (Card/Header/Title/Description/Content/Footer), Button (primary/secondary/outline/danger/ghost/soft; sm/md/lg/icon), pill Badges with status dots and a semantic tone map, Input/Select/Textarea with focus rings, Field wrapper (label/hint/error), Skeleton, EmptyState, ErrorState, Modal/Sheet/Menu/Tabs on Radix. API-compatible with the old primitives; no call-site logic changed.

## 3. App shell (`src/components/shell/*`)

Grouped collapsible sidebar (state persisted to localStorage), mobile drawer, breadcrumbs, command palette (Cmd+K, pages + live patient search), profile dropdown, notification bell, theme and locale toggles.

## 4. Pages redesigned

- Dashboard: tz-aware greeting, quick actions, 4 KPI cards with real previous-period deltas, 5 secondary tiles, revenue-vs-expenses area chart, appointment-status donut, doctor/branch performance bars, operational alerts computed from real numbers.
- Patients: sortable URL-driven DataTable v2 (search opt-in, column visibility, mobile card layout), avatars, gender filter, CSV export; profile with identity header, stat strip, Tabs (Overview/Medical/Prescriptions/Files & notes/Edit), medicalAccess-gated clinical data.
- Appointments: day schedule with status color edges and a "Now" line, week grid, month pills, detail drawer with real PATCH status transitions and history timeline.
- Reception: stat strip, lookup, live queue with working Call/Check-in actions.
- Doctor home: stats, next-up card, today's schedule (clinic-tz day boundary fix).
- Billing: stat strip, status pills, remaining column; invoice detail with items, totals, remaining banner, payments with receipt numbers, refunds, payment form.
- Reports: financial KPI strip, revenue vs expenses, payment-method donut, appointment activity, cancellation analysis, doctor/branch tables.
- Expenses / Inventory / Staff / Settings / Platform: stat tiles, card-wrapped forms, consistent DataTables.
- Patient portal: gradient welcome hero, stat strip, appointments with reschedule/cancel, invoices, prescriptions; booking page in a card.
- Public site: landing (sticky header, image hero, feature cards, clinic cards, demo note), clinic page (hero with stats, specialties, services, doctor cards, branch working hours, testimonials, FAQ, contact), doctor profile, booking wizard with progress stepper and i18n.
- Auth: split-screen shell (brand panel + form) for login/register/forgot/reset; global not-found and error pages; polished print prescription with Rx mark.

## 5. Imagery

Three Unsplash photos (free license) are self-hosted in `/public/media/` because the CSP is `img-src 'self' data: blob:`. Credit line appears on the landing and clinic footers. No hotlinks, no placeholder boxes.

## 6. i18n and RTL

- ~90 new Arabic strings added to `src/lib/i18n/phrases.ts`; new dict keys for public pages in `src/lib/i18n/dict.ts`.
- Chart series names, donut labels and tooltips translate via locale context.
- Screenshot harness bug fixed: it never set the `locale` cookie, so earlier "Arabic" shots were English. Now verified: sidebar mirrors, all chrome and content Arabic.

## 7. Demo data realism

Seed expenses were ~6x revenue (net income deeply negative). `prisma/seed.ts` expense bases rebalanced: Oct revenue 52,985 vs expenses 39,750 EGP; Nov-to-date 44,975 vs 38,748. September stays negative as the partial ramp-up month, which is realistic.

## 8. Bugs found and fixed during the redesign

- Doctor home used a UTC day range instead of the clinic timezone.
- Appointments minute-math bug in the schedule.
- Nullable gender rendered as a "null" badge.
- Patient edit form was hidden inside a collapsed `<details>` within the Edit tab.
- Duplicate headings collided with form `<summary>` toggles (strict-mode and a11y).
- Screenshot harness locale cookie (above) and stale-session caching across reseeds.

## 9. Verification (all on the isolated local instance, fictional data)

- `tsc --noEmit`: clean. `npm run build`: exit 0. `npm run lint`: clean.
- vitest: 94/94. HTTP suite: 18/18. Playwright e2e: 21/21 (52s).
- Playwright screenshot sweep: 17 routes at 1440px light EN, 1440px light AR, 1440px dark EN, 390px light EN; before/after sets kept under `/tmp/shots/`.
- `scripts/e2e-prep.mts` added: reopens today's cash register so the e2e suite is re-runnable against the seeded demo DB.

## 10. CI (Phase 7)

`.github/workflows/ci.yml` now runs lint, typecheck, unit tests, build (before tests, since the HTTP suite serves `.next`), the HTTP suite against a second database, a separate Playwright e2e job with Postgres service and seed, and a Docker image build job. Docker verification was not run locally (no Docker binary in this environment) - the CI job is the verification path.

## What was not changed

Backend services, API routes, Prisma schema, permissions, and business logic are untouched except for the two bugs in section 8 (timezone day range, minute math) and the seed rebalance.
