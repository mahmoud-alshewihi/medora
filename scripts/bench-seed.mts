/* v0.14 Phase 4 benchmark dataset generator: 50 clinics / 150 branches / 500 doctors /
   50k patients / 250k appointments / 100k invoices on a LOCAL isolated instance.
   Deterministic IDs, no overlap per doctor (exclusion constraint safe). */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const db = new PrismaClient();
const DIR = "/tmp/bench";
const stage = process.argv[2];
const HOURS = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), ["08:00", "20:00"]]));
const NOW = new Date().toISOString();

async function clinics() {
  const existing = await db.clinic.count({ where: { slug: { startsWith: "bench-" } } });
  if (existing >= 49) { console.log("synthetic clinics already present"); return; }
  for (let c = 2; c <= 50; c++) {
    const id = `bclinic${String(c).padStart(2, "0")}`;
    await db.clinic.upsert({ where: { id }, update: {}, create: { id, slug: `bench-${String(c).padStart(2, "0")}`, name: `Bench Clinic ${c}`, invoicePrefix: `BC${c}`, taxRatePercent: "0" } });
    const spec = await db.specialty.upsert({ where: { id: `bspec${c}` }, update: {}, create: { id: `bspec${c}`, clinicId: id, name: "General" } });
    for (let b = 1; b <= 3; b++) await db.branch.upsert({ where: { id: `bbr${c}_${b}` }, update: {}, create: { id: `bbr${c}_${b}`, clinicId: id, name: `Branch ${b}`, workingHours: HOURS } });
    for (let d = 1; d <= 10; d++) await db.doctor.upsert({ where: { id: `bdoc${c}_${d}` }, update: {}, create: { id: `bdoc${c}_${d}`, clinicId: id, fullName: `Dr Bench ${c}-${d}`, specialtyId: spec.id, consultationFee: "300" } });
    if (c % 10 === 0) console.log(`clinic ${c}/50`);
  }
}

function* patientRows() {
  for (let c = 1; c <= 50; c++) {
    const clinicId = c === 1 ? FLAG : `bclinic${String(c).padStart(2, "0")}`;
    for (let p = 1; p <= 1000; p++) yield [`bpat${c}_${p}`, clinicId, `BP-${c}-${p}`, `Bench Patient ${c}-${p}`, `+2010${String(10000000 + c * 100000 + p).slice(0, 8)}`, NOW];
  }
}
function* appointmentRows(doctors: { id: string; clinicId: string }[]) {
  let n = 0;
  for (const doc of doctors) {
    const branchId = doc.clinicId === FLAG ? FLAG_B1 : `bbr${Number(doc.clinicId.replace("bclinic", ""))}_1`;
    for (let s = 0; s < 500; s++) {
      n++;
      const day = new Date(Date.UTC(2026, 5, 1) + Math.floor(s / 16) * 86400000); // June 2026 onward, 16 half-hour slots/day => no overlap
      const start = new Date(day.getTime() + (9 * 60 + (s % 16) * 30) * 60000);
      const end = new Date(start.getTime() + 30 * 60000);
      yield [`bappt${n}`, doc.clinicId, branchId, doc.id, `bpat${doc.clinicId === FLAG ? 1 : Number(doc.clinicId.replace("bclinic", ""))}_${(n % 1000) + 1}`, `BENCH-A${n}`, start.toISOString(), end.toISOString(), "COMPLETED", "RECEPTION", NOW];
    }
  }
}
function* invoiceRows() {
  let n = 0;
  for (let c = 1; c <= 50; c++) {
    const clinicId = c === 1 ? FLAG : `bclinic${String(c).padStart(2, "0")}`;
    const branchId = c === 1 ? FLAG_B1 : `bbr${c}_1`;
    for (let i = 1; i <= 2000; i++) {
      n++;
      const r = n % 20; // 70% PAID, 15% PARTIALLY_PAID, 15% ISSUED
      const paid = r < 14 ? "300.00" : r < 17 ? "150.00" : "0.00";
      const status = r < 14 ? "PAID" : r < 17 ? "PARTIALLY_PAID" : "ISSUED";
      yield [`binv${n}`, clinicId, branchId, `bpat${c}_${(n % 1000) + 1}`, `BENCH-I${n}`, status, "300.00", "0.00", "0.00", "300.00", paid, "0.00"];
    }
  }
}

let FLAG = "", FLAG_B1 = "";
const esc = (v: string) => `"${String(v).replaceAll('"', '""')}"`;
function writeCsv(name: string, rows: Iterable<string[]>) {
  let buf = "", count = 0;
  const parts: string[] = [];
  for (const r of rows) { parts.push(r.map(esc).join(",")); if (++count % 50000 === 0) { buf = parts.join("\n") + "\n"; writeFileSync(`${DIR}/${name}.${count}.part`, buf); parts.length = 0; } }
  parts.push(""); writeFileSync(`${DIR}/${name}.csv`, parts.join("\n"));
  execSync(`cat ${DIR}/${name}.*.part 2>/dev/null >> ${DIR}/${name}.csv || true; rm -f ${DIR}/${name}.*.part`);
  console.log(`${name}: ${count} rows`);
}

if (stage === "clinics") { FLAG = (await db.clinic.findUniqueOrThrow({ where: { slug: "nile-care" } })).id; await clinics(); }
else if (stage === "gencsv") {
  mkdirSync(DIR, { recursive: true });
  FLAG = (await db.clinic.findUniqueOrThrow({ where: { slug: "nile-care" } })).id;
  FLAG_B1 = (await db.branch.findFirstOrThrow({ where: { clinicId: FLAG }, orderBy: { name: "asc" } })).id;
  writeCsv("patients", patientRows());
  const doctors = await db.doctor.findMany({ where: { OR: [{ clinicId: FLAG }, { clinic: { slug: { startsWith: "bench-" } } }] }, select: { id: true, clinicId: true } });
  console.log(`doctors: ${doctors.length}`);
  writeCsv("appointments", appointmentRows(doctors));
  writeCsv("invoices", invoiceRows());
  writeFileSync(`${DIR}/invoice_items.csv`, "");
  const buf: string[] = [];
  for (let n = 1; n <= 100000; n++) buf.push([`bitm${n}`, `binv${n}`, "Consultation", "1", "300.00", "300.00"].map(esc).join(","));
  writeFileSync(`${DIR}/invoice_items.csv`, buf.join("\n") + "\n");
  console.log("invoice_items: 100000 rows");
}
else if (stage === "load") {
  const psql = (sql: string) => execSync(`psql postgresql://medora:medora@127.0.0.1:5433/medora -c '${sql.replaceAll("'", "''")}'`, { stdio: "inherit" });
  psql(`\\copy "Patient" (id, "clinicId", mrn, "fullName", phone, "updatedAt") FROM '${DIR}/patients.csv' CSV`);
  psql(`\\copy "Appointment" (id, "clinicId", "branchId", "doctorId", "patientId", reference, "startsAt", "endsAt", status, source, "updatedAt") FROM '${DIR}/appointments.csv' CSV`);
  psql(`\\copy "Invoice" (id, "clinicId", "branchId", "patientId", number, status, subtotal, "discountAmount", "taxAmount", total, "paidAmount", "refundedAmount") FROM '${DIR}/invoices.csv' CSV`);
  psql(`\\copy "InvoiceItem" (id, "invoiceId", description, quantity, "unitPrice", "lineTotal") FROM '${DIR}/invoice_items.csv' CSV`);
}
else if (stage === "counts") {
  for (const t of ["clinic", "branch", "doctor", "patient", "appointment", "invoice", "invoiceItem"]) console.log(t, await (db as never as Record<string, { count(): Promise<number> }>)[t].count());
}
else if (stage === "analyze") { execSync(`psql "postgresql://medora:medora@127.0.0.1:5433/medora" -c "ANALYZE"`, { stdio: "inherit" }); }
else if (stage === "clean") {
  await db.invoiceItem.deleteMany({ where: { id: { startsWith: "bitm" } } });
  await db.invoice.deleteMany({ where: { id: { startsWith: "binv" } } });
  await db.appointment.deleteMany({ where: { id: { startsWith: "bappt" } } });
  await db.patient.deleteMany({ where: { id: { startsWith: "bpat" } } });
  await db.doctor.deleteMany({ where: { id: { startsWith: "bdoc" } } });
  await db.branch.deleteMany({ where: { id: { startsWith: "bbr" } } });
  await db.specialty.deleteMany({ where: { id: { startsWith: "bspec" } } });
  await db.clinic.deleteMany({ where: { id: { startsWith: "bclinic" } } });
  console.log("bench data removed");
}
await db.$disconnect();
