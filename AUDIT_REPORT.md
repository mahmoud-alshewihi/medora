# Medora v0.14 — AUDIT_REPORT.md (Phase 1: Full Codebase Audit)

Audit performed 2026-11-26 against the v0.13 tree by reading every file in `src/` (100 `.ts` + 63 `.tsx`, ~4,060 LOC), `prisma/schema.prisma`, both migrations, all 43 API routes, the test suites (vitest 6 files / e2e 1 file), Dockerfile, docker-compose.yml and the CI workflow. Findings were recorded **before** any code modification.

Severity: CRITICAL > HIGH > MEDIUM > LOW > INFO.

---

## A. Build / dependency integrity

### A1 (HIGH) `npm ci` fails → CI and Docker builds break at step one
- **Files:** `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `Dockerfile`
- **Evidence:** clean `npm ci` on Node 22.23.5 / npm 10.9.9 exits 1 during idealTree: `@hookform/resolvers@7.0.9` requires peer `effect@^4.0.0` while `@prisma/config@6.19.3` pins `effect@3.21.0` at the root. `npm ci --legacy-peer-deps` succeeds.
- **Root cause:** `react-hook-form` and `@hookform/resolvers` are declared but **used nowhere** in `src/` (verified: zero imports). The peer conflict comes from this dead dependency.
- **Fix:** remove `react-hook-form` + `@hookform/resolvers` (also dead: `@tanstack/react-table` — zero imports; `@tanstack/react-query` stays, it is used).
- **Verification:** `npm ci` from a clean checkout passes; CI workflow and Dockerfile keep plain `npm ci`.

### A2 (MEDIUM) No `.dockerignore`; build context ships `node_modules`, `.env`, `storage/`
- **Files:** repo root, `Dockerfile`
- **Root cause:** file never created.
- **Fix:** add `.dockerignore` (node_modules, .next, .env, storage, tsconfig.tsbuildinfo).
- **Verification:** `docker build` context size (blocked locally — no Docker; statically verified file list).

### A3 (LOW) Build artifact committed: `tsconfig.tsbuildinfo`
- **Files:** `tsconfig.tsbuildinfo` (346 KB in the shipped zip)
- **Fix:** delete and add to `.gitignore`.

---

## B. Security (summary here; full exploitation evidence in SECURITY_REPORT.md)

### B1 (HIGH) Rate limits keyed on a spoofable IP
- **Files:** `src/server/http/handler.ts` (`clientIp`, `rateLimit`), used by `api/public/book`, `api/public/slots`, `api/public/clinics`, `api/portal/register`
- **Root cause:** `x-forwarded-for` is trusted unconditionally; each request can present a fresh `X-Forwarded-For` and reset its bucket. In-memory buckets are also per-process (noted in code, but the spoofing makes even single-instance limits void).
- **Fix:** only trust the proxy-added hop (last value), document the single-proxy assumption, key on the right-most untrusted IP; keep better-auth's own limiter for `/api/auth/*`.
- **Verification:** security regression test sending varying `X-Forwarded-For` still hits the limit.

### B2 (HIGH) Branch-scope bypass on inventory mutations
- **Files:** `src/app/api/inventory/consume/route.ts`, `src/app/api/inventory/transfer/route.ts`, `src/app/api/inventory/purchase-orders/route.ts`, `src/server/inventory/service.ts`
- **Root cause:** `receiveStock`/`adjustStock` enforce the actor's branch; `consumeStock`, `transferStock` and PO creation accept any `branchId`. A branch-pinned `BRANCH_MANAGER` (has `inventory.manage`) can consume/transfer/order at branches outside their scope. Appointment/invoice/expense endpoints pin the branch; inventory is inconsistent.
- **Fix:** pass `ctx.branchId` into the three services and assert batch/branch scope server-side (write a failing regression test first).
- **Verification:** new security tests: branch-scoped actor gets 404/403 on out-of-branch consume/transfer/PO.

### B3 (MEDIUM) Missing Content-Security-Policy
- **Files:** `next.config.mjs`
- **Root cause:** only X-Frame-Options / nosniff / Referrer-Policy / Permissions-Policy are set. React escaping is the primary XSS defence (no `dangerouslySetInnerHTML` found in `src/`), but CSP is the standard second layer for a medical app.
- **Fix:** add a CSP allowing self + inline styles (Tailwind) with `frame-ancestors 'none'`.
- **Verification:** response header present in e2e smoke check; no console CSP violations on main pages.

### B4 (LOW) Malformed `Origin` header produces 500 instead of 403
- **Files:** `src/server/http/handler.ts` (`assertSameOrigin`)
- **Root cause:** `new URL(origin)` throws outside the AppError path.
- **Fix:** wrap in try/catch → 403.
- **Verification:** unit test with `Origin: ::garbage::` on a POST.

### B5 (LOW) Audit log never records the client IP
- **Files:** `src/server/audit/audit.ts` (the `ip` field exists but no caller passes it)
- **Fix:** pass `clientIp(req)` from `secured()` context into `audit()` for sensitive actions.
- **Verification:** audit row for a payment contains an IP.

### B6 (INFO) Session revocation on password reset depends on better-auth defaults
- **Files:** `src/server/auth/auth.ts`
- **Note:** suspension deletes sessions (`setStaffStatus`) and per-request `user.status` check covers suspended users. Password-reset session revocation is not explicitly configured; verified empirically in Phase 2 and documented in SECURITY_REPORT.md.

---

## C. Concurrency / transaction integrity (test evidence in Phase 3 / TEST_COVERAGE_REPORT.md)

### C1 (HIGH) Purchase-order receive: check-then-act race double-adds stock
- **Files:** `src/server/inventory/service.ts` (`receivePurchaseOrder`)
- **Root cause:** reads `po.status`, then receives lines, then updates status — no row lock. Two concurrent receives both pass the status check and both add stock.
- **Fix:** `UPDATE "PurchaseOrder" SET status='RECEIVED' ... WHERE id=? AND status='ORDERED'` first and abort when 0 rows (atomic claim), inside the transaction.
- **Verification:** new concurrency test: N simultaneous receives → stock added exactly once.

### C2 (HIGH) Cash-register close races with concurrent cash payments
- **Files:** `src/server/billing/service.ts` (`closeCashRegister`, `recordPayment`)
- **Root cause:** close reads payments and computes `expectedCash` without locking the register row; a payment can be created between the read and the `closedAt` update, producing a wrong expected/variance. Conversely `recordPayment` upserts the register without a lock, so it can also interleave with the close.
- **Fix:** `SELECT ... FOR UPDATE` on the register row in both paths (close first, then compute; payment locks then checks `closedAt`).
- **Verification:** concurrency test: payment vs close in either order ends in a consistent state (payment rejected OR included in expected).

### C3 (MEDIUM) Duplicate-key race on payment/refund idempotency returns 500
- **Files:** `src/server/billing/service.ts` (`recordPayment`, `refundPayment`)
- **Root cause:** duplicate check (`findUnique`) then `create`; two concurrent same-key requests both pass the check, one hits `P2002` which is not mapped → 500 INTERNAL.
- **Fix:** catch `P2002` on create → re-read and return `{ duplicate: true }` (payment) or conflict on mismatch.
- **Verification:** concurrency test with 10 identical idempotency keys → one created, nine clean duplicates, zero 500s.

### C4 (MEDIUM) Plan-limit TOCTOU
- **Files:** `src/server/platform/service.ts` (`enforcePlanLimit`), callers `registerPatient`, `createStaff`, `settings/catalog`
- **Root cause:** count check and insert are not atomic; N concurrent registrations can exceed `maxPatients`.
- **Fix:** move the limit check inside the same transaction after locking the `Subscription` row (`SELECT ... FOR UPDATE`).
- **Verification:** concurrency test: 20 parallel registrations against a limit of N → exactly N created.

### C5 (MEDIUM) `completeConsultation` spans two transactions
- **Files:** `src/server/clinical/service.ts`
- **Root cause:** `changeStatus(... COMPLETED)` commits before the transaction that writes the medical record and invoice; a failure in the second leaves the appointment COMPLETED with no record/invoice.
- **Fix:** one transaction (pass a tx into changeStatus or inline the update).
- **Verification:** regression test forcing invoice failure → appointment not COMPLETED.

### C6 (LOW) Opposite-direction concurrent transfers can deadlock (40P01 → 500)
- **Files:** `src/server/inventory/service.ts` (`transferStock` → `move` locks batches in call order)
- **Fix:** lock batches in deterministic id order inside `transferStock`.
- **Verification:** concurrency test A→B with B→A completes without 500 (deadlock abort mapped to 409).

---

## D. Architecture / code quality

### D1 (MEDIUM) Dead code and dead schema
- **Files:** `tests/setup-env.ts` (empty, 0 lines), `src/server/appointments/slots.ts` (`isSlotBookable` — zero callers; `void tz`), `src/app/api/portal/overview/route.ts` (`void z`), `prisma/schema.prisma` (`IdempotencyKey` model — unused; billing uses its own per-clinic keys), `src/server/billing/service.ts` (`export { AppError }` re-export)
- **Fix:** delete all of the above (dropping the unused table via migration).
- **Verification:** tsc + full test suite green.

### D2 (LOW) Unnecessary dynamic imports in hot paths
- **Files:** `src/server/portal/service.ts` (`await import("@/lib/money")` inside a reduce), `src/app/api/inventory/items/route.ts` and `src/app/api/settings/catalog/route.ts` (`await import("@/lib/errors")`)
- **Fix:** static imports.

### D3 (LOW) N+1 / per-row transactions in CSV import
- **Files:** `src/server/patients/service.ts` (`importPatientsCsv`)
- **Root cause:** each row runs `registerPatient` → own transaction + own `enforcePlanLimit` (2 round trips each) + audit row. 5,000 rows ≈ 15k+ sequential round trips.
- **Fix:** batch plan-limit check once, `createMany` in chunks, single summary audit entry.
- **Verification:** import test still passes; timing recorded in PERFORMANCE_REPORT.md.

### D4 (INFO) React/hook/component review
- Components are small (largest 84 LOC) and mostly thin server components; no `dangerouslySetInnerHTML`; no oversized modules. Full visual/interaction audit (re-renders, keyboard, RTL) is Phase 6 with a real browser; findings land in ENGINEERING_REPORT.md.

---

## E. Database

### E1 (MEDIUM) Indexes missing for the benchmark-scale access patterns
- **Files:** `prisma/schema.prisma`
- **Root cause:** `searchPatients` filters `clinicId + archivedAt` and sorts by `createdAt`/`fullName`, and does `ILIKE '%q%'` on `fullName/phone/mrn/email`. Existing indexes: `(clinicId, fullName)` (no archivedAt, useless for `contains` matches), `(clinicId, phone)` (equality prefix only). At 50k patients/clinic these are seq scans.
- **Fix:** add `(clinicId, archivedAt, createdAt)` index; enable `pg_trgm` + GIN trigram indexes on `fullName`, `phone`, `mrn` for `contains` search.
- **Verification:** `EXPLAIN` before/after on the benchmark dataset (Phase 4 numbers).

### E2 (LOW) `PatientNote` has no `clinicId`
- **Files:** `prisma/schema.prisma`
- **Root cause:** tenant isolation relies on joining through `Patient`. Current callers verify the patient first, so no leak, but the table breaks the "every tenant row carries clinicId" invariant the rest of the schema follows.
- **Fix:** add `clinicId` (+ backfill migration) and filter on it.
- **Verification:** migration applies; tenant-isolation test for notes.

### E3 (INFO) Existing DB-level integrity is good
- Verified present in migration `20261125144705_integrity_constraints`: exclusion constraint `appointment_doctor_no_overlap` (cross-branch overlap impossible even bypassing app code), `invoice_amounts_valid`, `payment_positive`, `refund_positive`, `batch_non_negative`, `item_min_non_negative`, `appointment_time_order`. Covered by the "database exclusion constraint" vitest test.

---

## F. Test coverage honesty (full review in Phase 8)

### F1 (MEDIUM) All 76 vitest tests call service functions with fabricated contexts — the HTTP layer is untested
- **Files:** `tests/*.ts`
- **Root cause:** no test exercises `secured()`/`open()`: zod validation status codes, CSRF origin checks, rate limiting, cookie/session handling, branch pinning at the route level (B2 would not have been caught).
- **Fix:** add an HTTP-layer test suite that boots the Next server and attacks real endpoints (Phase 2 regression tests live there).
- **Verification:** new `tests/http/*.test.ts` run in CI.

### F2 (LOW) Existing assertions were spot-checked, not trusted
- Sampled `security.test.ts` (tenant isolation, medical access), `billing.test.ts` (money maths), `appointments.test.ts` (exclusion constraint), `inventory.test.ts` (FEFO, concurrency). Assertions are real (DB state re-read after actions), not tautological. Gaps are at the HTTP layer and in the races listed in section C, not in fake assertions.

### F3 (INFO) e2e covers 21 flows through Playwright but none for: transfer UI, printable invoice, public booking validation errors, mobile viewports. Addressed in Phases 5/6.

---

## Fix order (applied in later phases, each with its regression test first)
1. A1 (dead deps → npm ci) — unblocks CI/Docker. 2. B2 branch scope. 3. C1/C2/C3/C4 transaction races. 4. B1 rate-limit IP. 5. C5 consultation atomicity. 6. C6 transfer lock order. 7. B3 CSP, B4 origin, B5 audit IP. 8. D1–D3 dead code/perf. 9. E1/E2 indexes & PatientNote.
