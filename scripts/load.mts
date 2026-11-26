/* v0.14 Phase 4 load harness: closed-loop virtual users against a locally booted `next start`.
   Each virtual user sends a distinct X-Forwarded-For (what a production proxy appends), so the
   per-IP rate limiter sees realistic per-user traffic. Real numbers only; environment recorded. */
import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync } from "node:fs";
import * as fs from "node:fs";
import os from "node:os";
import { PrismaClient } from "@prisma/client";

const PORT = 3300, BASE = `http://localhost:${PORT}`;
const endpoint = process.argv[2]!;
const levels = (process.argv[3] ?? "10,50,100,200").split(",").map(Number);
const durationMs = Number(process.argv[4] ?? 6) * 1000;

async function waitHealth(server: ChildProcess) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return; } catch { }
    if (server.exitCode !== null) throw new Error("server exited");
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("health timeout");
}

type Ctx = { cookie: string; doctorId: string; doctorIds: string[]; branchId: string };
async function makeCtx(): Promise<Ctx> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ email: "owner@nile.medora.test", password: "Medora#Demo2026" }) });
  if (!r.ok) throw new Error("sign-in failed " + r.status);
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0]!;
  const db = new PrismaClient();
  const clinic = await db.clinic.findUniqueOrThrow({ where: { slug: "nile-care" } });
  const docs = await db.doctor.findMany({ where: { clinicId: clinic.id, id: { startsWith: "bdoc" } } });
  const doc = docs[0]!;
  const branch = await db.branch.findFirstOrThrow({ where: { clinicId: clinic.id } });
  await db.$disconnect();
  return { cookie, doctorId: doc.id, doctorIds: docs.map((d) => d.id), branchId: branch.id };
}

function requestFor(ep: string, ctx: Ctx, user: number, seq: number): { url: string; init: RequestInit } {
  const xff = `10.0.${Math.floor(user / 250)}.${user % 250}`;
  const h: Record<string, string> = { "x-forwarded-for": xff };
  const authH = { ...h, cookie: ctx.cookie };
  switch (ep) {
    case "pub-clinics": return { url: `${BASE}/api/public/clinics`, init: { headers: h } };
    case "pub-slots": return { url: `${BASE}/api/public/slots?clinicSlug=nile-care&doctorId=${ctx.doctorId}&branchId=${ctx.branchId}&date=2026-12-0${1 + (seq % 5)}`, init: { headers: h } };
    case "pub-book": {
      const day = 7 + (seq % 5), hour = 9 + (user % 8), min = seq % 2 ? "30" : "00";
      const docId = ctx.doctorIds[user % ctx.doctorIds.length]!;
      return { url: `${BASE}/api/public/book`, init: { method: "POST", headers: { ...h, "content-type": "application/json", origin: BASE },
        body: JSON.stringify({ clinicSlug: "nile-care", branchId: ctx.branchId, doctorId: docId, startsAt: `2026-12-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${min}:00+02:00`,
          patient: { fullName: `Load User ${user}`, phone: `+20155${String(1000000 + user * 100 + (seq % 90)).slice(0, 7)}`, email: "" } }) } };
    }
    case "auth-patients": return { url: `${BASE}/api/patients?page=${1 + (seq % 20)}`, init: { headers: authH } };
    case "auth-appointments": return { url: `${BASE}/api/appointments?from=2026-06-${String(1 + (seq % 25)).padStart(2, "0")}&to=2026-06-${String(2 + (seq % 25)).padStart(2, "0")}&pageSize=200`, init: { headers: authH } };
    case "auth-invoices": return { url: `${BASE}/api/invoices?page=${1 + (seq % 40)}`, init: { headers: authH } };
    default: throw new Error("unknown endpoint " + ep);
  }
}

async function runLevel(ep: string, ctx: Ctx, conc: number) {
  const lat: number[] = [];
  const statuses = new Map<number, number>();
  let errors = 0, done = 0;
  const deadline = Date.now() + durationMs;
  async function worker(u: number) {
    let seq = u * 100000;
    while (Date.now() < deadline) {
      const { url, init } = requestFor(ep, ctx, u, seq++);
      const t0 = performance.now();
      try {
        const r = await fetch(url, init);
        await r.arrayBuffer();
        statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
        lat.push(performance.now() - t0);
      } catch { errors++; }
      done++;
    }
  }
  await Promise.all(Array.from({ length: conc }, (_, u) => worker(u)));
  lat.sort((a, b) => a - b);
  const p = (q: number) => lat.length ? +lat[Math.min(lat.length - 1, Math.floor(q * lat.length))]!.toFixed(1) : 0;
  const rec = { endpoint: ep, concurrency: conc, seconds: durationMs / 1000, requests: done, networkErrors: errors,
    statusCounts: Object.fromEntries([...statuses].sort()), rps: +(done / (durationMs / 1000)).toFixed(1),
    p50: p(0.5), p95: p(0.95), p99: p(0.99),
    env: { node: process.version, cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model ?? "", memGB: Math.round(os.totalmem() / 2 ** 30) } };
  appendFileSync("/tmp/bench/results.jsonl", JSON.stringify(rec) + "\n");
  console.log(`${ep} c=${conc}: ${rec.rps} rps, p50=${rec.p50}ms p95=${rec.p95}ms p99=${rec.p99}ms, statuses=${JSON.stringify(rec.statusCounts)}, netErr=${errors}`);
}

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env: { ...process.env, DATABASE_URL: "postgresql://medora:medora@127.0.0.1:5433/medora", BETTER_AUTH_SECRET: "load-test-secret-load-test-secret-123", BETTER_AUTH_URL: BASE, NEXT_PUBLIC_APP_URL: BASE, AUTH_SIGNIN_MAX: "200" }, stdio: ["ignore", fs.openSync(`/tmp/bench/server-${endpoint}.log`, "w"), fs.openSync(`/tmp/bench/server-${endpoint}.err.log`, "w")] });
try {
  await waitHealth(server);
  const ctx = await makeCtx();
  for (const conc of levels) await runLevel(endpoint, ctx, conc);
} finally { server.kill("SIGTERM"); }
process.exit(0);
