/* Phase 2 HTTP-layer security regression tests against the real running server.
   Tests asserting FIXED behavior fail on the pre-fix build (that failure is the
   vulnerability evidence) and pass after the fix. */
import { beforeAll, describe, expect, it } from "vitest";
import { BASE, fixtures, jsonHeaders, signIn } from "./helpers";

const PW = "HttpTest#2026";
let fx: Awaited<ReturnType<typeof fixtures>>;
let ownerA: string, managerA: string, ownerB: string;

beforeAll(async () => {
  fx = await fixtures();
  ownerA = await signIn("owner@alpha.test", PW);
  managerA = await signIn("manager@alpha.test", PW);
  ownerB = await signIn("owner@beta.test", PW);
});

describe("authentication & authorization basics", () => {
  it("unauthenticated requests are 401", async () => {
    const r = await fetch(`${BASE}/api/patients?page=1`);
    expect(r.status).toBe(401);
  });
  it("cross-tenant IDOR: clinic A owner cannot read clinic B patient", async () => {
    const r = await fetch(`${BASE}/api/patients/${fx.patientB}`, { headers: jsonHeaders(ownerA) });
    expect(r.status).toBe(404);
  });
  it("platform endpoints reject clinic owners", async () => {
    const r = await fetch(`${BASE}/api/platform/clinics`, { headers: jsonHeaders(ownerA) });
    expect([401, 403]).toContain(r.status);
  });
  it("error responses do not leak stack traces or ORM internals", async () => {
    const r = await fetch(`${BASE}/api/patients/not-a-real-id`, { headers: jsonHeaders(ownerA) });
    const body = await r.text();
    expect(body).not.toMatch(/prisma|at\s+\w+\s+\(|node_modules/i);
  });
});

describe("branch-level permission bypass (fixed behavior expected)", () => {
  it("branch-pinned manager cannot consume stock at another branch", async () => {
    const r = await fetch(`${BASE}/api/inventory/consume`, { method: "POST", headers: jsonHeaders(managerA), body: JSON.stringify({ itemId: fx.itemA, branchId: fx.branchA2, quantity: 1 }) });
    expect([403, 404]).toContain(r.status); // pre-fix: 200 (vulnerability)
  });
  it("branch-pinned manager cannot transfer stock out of another branch", async () => {
    const r = await fetch(`${BASE}/api/inventory/transfer`, { method: "POST", headers: jsonHeaders(managerA), body: JSON.stringify({ batchId: fx.batchA2, toBranchId: fx.branchA1, quantity: 1 }) });
    expect([403, 404]).toContain(r.status); // pre-fix: 200 (vulnerability)
  });
  it("branch-pinned manager cannot create a purchase order for another branch", async () => {
    const r = await fetch(`${BASE}/api/inventory/purchase-orders`, { method: "POST", headers: jsonHeaders(managerA), body: JSON.stringify({ supplierId: fx.supplierA, branchId: fx.branchA2, lines: [{ itemId: fx.itemA, quantity: 1, unitCost: "1" }] }) });
    expect([403, 404]).toContain(r.status); // pre-fix: 200 (vulnerability)
  });
});

describe("CSRF", () => {
  it("cross-origin POST with a valid session is rejected", async () => {
    const r = await fetch(`${BASE}/api/patients`, { method: "POST", headers: jsonHeaders(ownerA, { Origin: "https://evil.example" }), body: JSON.stringify({ fullName: "X" }) });
    expect(r.status).toBe(403);
  });
  it("malformed Origin is rejected with 403, not a 500 crash (fixed behavior)", async () => {
    const r = await fetch(`${BASE}/api/patients`, { method: "POST", headers: jsonHeaders(ownerA, { Origin: "::not-a-url::" }), body: JSON.stringify({ fullName: "X" }) });
    expect(r.status).toBe(403); // pre-fix: 500
  });
});

describe("rate limiting (fixed behavior expected)", () => {
  it("spoofing the first X-Forwarded-For hop does not reset the limiter", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await fetch(`${BASE}/api/portal/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `203.0.113.${i}, 198.51.100.99` },
        body: JSON.stringify({ clinicSlug: "beta", fullName: "Rate Test", email: `rate${i}@x.test`, password: "Password#1", phone: "+2010000000" }),
      });
      statuses.push(r.status);
    }
    expect(statuses).toContain(429); // pre-fix: every request gets a fresh bucket (no 429)
  });
});

describe("mass assignment", () => {
  it("unknown/protected fields in PATCH are ignored", async () => {
    const r = await fetch(`${BASE}/api/patients/${fx.patientA}`, { method: "PATCH", headers: jsonHeaders(ownerA), body: JSON.stringify({ phone: "+2011111", clinicId: fx.clinicB, mrn: "HACKED", userId: "x" }) });
    expect(r.status).toBe(200);
    const g = await fetch(`${BASE}/api/patients/${fx.patientA}`, { headers: jsonHeaders(ownerA) });
    const p = (await g.json()).data;
    expect(p.mrn).not.toBe("HACKED");
    expect(p.phone).toBe("+2011111");
  });
});

describe("file upload validation & private attachment authorization", () => {
  let attachmentId: string;
  it("rejects content that does not match the declared type", async () => {
    const form = new FormData();
    form.set("file", new File([Buffer.from("this is not a pdf")], "x.pdf", { type: "application/pdf" }));
    const r = await fetch(`${BASE}/api/patients/${fx.patientA}/attachments`, { method: "POST", headers: { Cookie: ownerA, Origin: BASE }, body: form });
    expect(r.status).toBe(400);
  });
  it("accepts a real PDF and the file requires authorization to read", async () => {
    const form = new FormData();
    form.set("file", new File([Buffer.from("%PDF-1.4 fake body")], "lab.pdf", { type: "application/pdf" }));
    const up = await fetch(`${BASE}/api/patients/${fx.patientA}/attachments`, { method: "POST", headers: { Cookie: ownerA, Origin: BASE }, body: form });
    expect(up.status).toBe(200);
    attachmentId = (await up.json()).data.id;
    const anon = await fetch(`${BASE}/api/attachments/${attachmentId}`);
    expect(anon.status).toBe(401);
    const other = await fetch(`${BASE}/api/attachments/${attachmentId}`, { headers: jsonHeaders(ownerB) });
    expect(other.status).toBe(404);
    const ok = await fetch(`${BASE}/api/attachments/${attachmentId}`, { headers: jsonHeaders(ownerA) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
  });
  it("rejects files over 5 MB", async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 65);
    big.write("%PDF-", 0);
    const form = new FormData();
    form.set("file", new File([big], "big.pdf", { type: "application/pdf" }));
    const r = await fetch(`${BASE}/api/patients/${fx.patientA}/attachments`, { method: "POST", headers: { Cookie: ownerA, Origin: BASE }, body: form });
    expect(r.status).toBe(400);
  });
});

describe("session invalidation", () => {
  it("suspending a user kills access for an already-issued session", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { hashPassword } = await import("better-auth/crypto");
    const { randomUUID } = await import("node:crypto");
    const db = new PrismaClient();
    const role = await db.role.findUniqueOrThrow({ where: { key: "RECEPTIONIST" } });
    const id = randomUUID();
    await db.user.create({ data: { id, name: "Temp Rec", email: "temprec@alpha.test", emailVerified: true } });
    await db.account.create({ data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(PW) } });
    await db.membership.create({ data: { userId: id, roleId: role.id, clinicId: fx.clinicA } });
    const cookie = await signIn("temprec@alpha.test", PW);
    const before = await fetch(`${BASE}/api/patients?page=1`, { headers: jsonHeaders(cookie) });
    expect(before.status).toBe(200);
    await db.user.update({ where: { id }, data: { status: "SUSPENDED" } });
    const after = await fetch(`${BASE}/api/patients?page=1`, { headers: jsonHeaders(cookie) });
    expect(after.status).toBe(401);
    await db.$disconnect();
  });
});

describe("security headers (fixed behavior expected)", () => {
  it("pages carry a Content-Security-Policy", async () => {
    const r = await fetch(`${BASE}/login`);
    expect(r.headers.get("content-security-policy")).toBeTruthy(); // pre-fix: absent
  });
});

describe("review #10: purchase order validation", () => {
  it("negative unit cost is rejected with 4xx, not stored", async () => {
    const r = await fetch(`${BASE}/api/inventory/purchase-orders`, { method: "POST", headers: jsonHeaders(managerA), body: JSON.stringify({ supplierId: fx.supplierA, branchId: fx.branchA1, lines: [{ itemId: fx.itemA, quantity: 1, unitCost: "-5" }] }) });
    expect([400, 422]).toContain(r.status);
  });
  it("non-numeric unit cost is rejected with 4xx", async () => {
    const r = await fetch(`${BASE}/api/inventory/purchase-orders`, { method: "POST", headers: jsonHeaders(managerA), body: JSON.stringify({ supplierId: fx.supplierA, branchId: fx.branchA1, lines: [{ itemId: fx.itemA, quantity: 1, unitCost: "abc" }] }) });
    expect([400, 422]).toContain(r.status);
  });
});
