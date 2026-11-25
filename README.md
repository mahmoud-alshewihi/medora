# Medora, multi-tenant clinic management platform

> **Status: partial build (v0.4).** The backend, schema, RBAC, services and API are built and tested; some UI screens are still placeholders. See [ENGINEERING_REPORT.md](ENGINEERING_REPORT.md) for what was verified and what is not finished. Docker and CI files are untested.

Next.js 15 (App Router), TypeScript strict, Tailwind, Prisma + PostgreSQL, Better Auth, Vitest.

## Run locally
1. `cp .env.example .env` and set `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ chars).
2. `npm install && npx prisma migrate deploy && npm run db:seed`
3. `npm run dev` then open http://localhost:3000

## Demo accounts (dev only), password `Medora#Demo2026`
`superadmin@medora.test`; per clinic (`nile`, `delta`, `alex`): `owner@`, `manager@`, `reception@`, `accountant@`, `nurse@`, `doctor@`, `patient@<clinic>.medora.test`.

## Verify
`npm run lint && npm run typecheck && npm test && npm run build`. Tests need Postgres and reset the `medora_test` database.

## Backup / restore
`pg_dump -Fc $DATABASE_URL > medora.dump` ; `pg_restore -d $DATABASE_URL --clean medora.dump`.

See ENGINEERING_REPORT.md for what is and is not finished.
