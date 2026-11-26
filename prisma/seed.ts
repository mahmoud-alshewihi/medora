/* Medora demo seed. All people, clinics and data are fictional. Development-only credentials. */
import { randomUUID } from "node:crypto";
import { PrismaClient, type AppointmentStatus, type PaymentMethod, type RoleKey, type Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { ROLE_PERMISSIONS, PERMISSIONS } from "../src/server/auth/permissions";
import { computeInvoiceTotals, D } from "../src/lib/money";
import { fromMinutes, toMinutes, zonedToUtc, todayIn } from "../src/lib/tz";

const db = new PrismaClient();
export const DEMO_PASSWORD = "Medora#Demo2026";
const TZ = "Africa/Cairo";

// Deterministic PRNG so the seed is reproducible.
let seedState = 20261125;
const rnd = () => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return seedState / 4294967296; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]!;
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p: number) => rnd() < p;
const uid = () => randomUUID();

const FIRST_M = ["Omar", "Youssef", "Karim", "Hassan", "Tamer", "Ali", "Mostafa", "Khaled", "Adel", "Sherif", "Hany", "Walid", "Ziad", "Mazen", "Amr", "Ibrahim"];
const FIRST_F = ["Nour", "Salma", "Mariam", "Laila", "Dina", "Heba", "Rania", "Farah", "Yasmin", "Amira", "Hoda", "Reem", "Sara", "Mona", "Jana", "Aya"];
const LAST = ["Haddad", "Mansour", "Farouk", "Saad", "Nabil", "Gamal", "Fouad", "Sami", "Barakat", "Zaki", "Lotfy", "Hegazy", "Fathy", "Rashad", "Sayed", "Anwar", "Selim", "Tawfik"];
const ALLERGIES = ["Penicillin", "Peanuts", "Latex", "Dust mites", "Pollen", "Shellfish", "Ibuprofen"];
const CHRONIC = ["Hypertension", "Type 2 diabetes", "Asthma", "Hypothyroidism", "Migraine", "GERD"];
const DIAGNOSES = ["Seasonal allergic rhinitis", "Mild hypertension, follow-up", "Viral upper respiratory infection", "Lower back strain", "Vitamin D deficiency", "Tension headache", "Contact dermatitis", "Gastritis", "Routine check-up, no findings"];
const MEDS = [["Paracetamol 500mg", "1 tablet", "Every 8 hours", "5 days"], ["Cetirizine 10mg", "1 tablet", "Once daily", "10 days"], ["Omeprazole 20mg", "1 capsule", "Once daily before breakfast", "14 days"], ["Vitamin D3 50,000 IU", "1 capsule", "Once weekly", "8 weeks"]];

const CLINICS = [
  { slug: "nile-care", name: "Nile Care Clinic", nameAr: "عيادة نايل كير", tax: "0", prefix: "NCC", branches: [["Maadi", "Cairo"], ["Nasr City", "Cairo"], ["Heliopolis", "Cairo"]], doctors: 8, patients: 220 },
  { slug: "delta-health", name: "Delta Health Center", nameAr: "مركز دلتا الصحي", tax: "14", prefix: "DHC", branches: [["Mansoura Main", "Mansoura"], ["Talkha", "Talkha"]], doctors: 7, patients: 170 },
  { slug: "alex-family", name: "Alexandria Family Clinic", nameAr: "عيادة الإسكندرية للأسرة", tax: "0", prefix: "AFC", branches: [["Smouha", "Alexandria"], ["Sidi Gaber", "Alexandria"]], doctors: 5, patients: 110 },
];
const SPECIALTIES = [["General Practice", "طب عام"], ["Cardiology", "قلب"], ["Dermatology", "جلدية"], ["Pediatrics", "أطفال"], ["Orthopedics", "عظام"], ["Gynecology", "نساء وتوليد"], ["ENT", "أنف وأذن وحنجرة"], ["Dentistry", "أسنان"]];

async function main() {
  const t0 = Date.now();
  const hash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();
  const today = todayIn(TZ, now);
  const dayStr = (off: number) => new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) + off)).toISOString().slice(0, 10);
  const wdOf = (s: string) => new Date(s + "T00:00:00Z").getUTCDay();

  console.log("Resetting data...");
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '\_prisma%'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

  // Roles & permissions
  const roleIds = {} as Record<RoleKey, string>;
  for (const code of PERMISSIONS) await db.permission.create({ data: { code } });
  const perms = await db.permission.findMany();
  for (const [key, list] of Object.entries(ROLE_PERMISSIONS) as [RoleKey, string[]][]) {
    const r = await db.role.create({ data: { key, name: key.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) } });
    roleIds[key] = r.id;
    await db.rolePermission.createMany({ data: perms.filter((p) => list.includes(p.code)).map((p) => ({ roleId: r.id, permissionId: p.id })) });
  }

  // Plans
  const plans = await Promise.all([
    db.subscriptionPlan.create({ data: { code: "basic", name: "Basic", priceMonthly: "499", maxBranches: 2, maxDoctors: 5, maxPatients: 1000 } }),
    db.subscriptionPlan.create({ data: { code: "pro", name: "Professional", priceMonthly: "1499", maxBranches: 5, maxDoctors: 25, maxPatients: 20000 } }),
    db.subscriptionPlan.create({ data: { code: "enterprise", name: "Enterprise", priceMonthly: "4999", maxBranches: 50, maxDoctors: 500, maxPatients: 1000000 } }),
  ]);

  const users: Prisma.UserCreateManyInput[] = [];
  const accounts: Prisma.AccountCreateManyInput[] = [];
  const memberships: Prisma.MembershipCreateManyInput[] = [];
  const addUser = (name: string, email: string, role: RoleKey, clinicId: string | null, branchId: string | null = null) => {
    const id = uid();
    users.push({ id, name, email, emailVerified: true });
    accounts.push({ id: uid(), accountId: id, providerId: "credential", userId: id, password: hash });
    memberships.push({ userId: id, roleId: roleIds[role], clinicId, branchId });
    return id;
  };
  addUser("Platform Admin", "superadmin@medora.test", "SUPER_ADMIN", null);

  const summary: string[] = ["superadmin@medora.test | SUPER_ADMIN | platform"];
  const allPatients: { id: string; clinicId: string; userId?: string }[] = [];
  const clinicData: Array<{ id: string; branches: { id: string }[]; doctors: { id: string; userId: string; fee: number; commission: number; dur: number; schedules: { branchId: string; weekday: number; start: string; end: string }[] }[]; patientIds: string[]; services: { id: string; price: number }[]; tz: string; tax: string; prefix: string }> = [];

  for (const [ci, c] of CLINICS.entries()) {
    const clinic = await db.clinic.create({
      data: { slug: c.slug, name: c.name, nameAr: c.nameAr, description: `${c.name} provides outpatient care across ${c.branches.length} branches. Demo content.`, phone: `+20 2 ${3000 + ci}0000`, email: `info@${c.slug}.medora.test`, address: `${c.branches[0]![1]}, Egypt`, taxRatePercent: c.tax, invoicePrefix: c.prefix, invoiceFooter: "Thank you for choosing us. This is a demonstration clinic." },
    });
    await db.subscription.create({ data: { clinicId: clinic.id, planId: plans[ci === 0 ? 2 : 1]!.id, status: ci === 2 ? "TRIALING" : "ACTIVE", startsAt: new Date(now.getTime() - 90 * 86400000), expiresAt: new Date(now.getTime() + (ci === 2 ? 20 : 300) * 86400000) } });
    const hours = Object.fromEntries([0, 1, 2, 3, 4].map((d) => [String(d), ["09:00", "21:00"]]).concat([["6", ["10:00", "16:00"]]]));
    const branches = [];
    for (const [bn, city] of c.branches) branches.push(await db.branch.create({ data: { clinicId: clinic.id, name: bn!, city, address: `${bn}, ${city}`, phone: `+20 1${int(0, 2)}${int(10000000, 99999999)}`, workingHours: hours } }));
    const specs = [];
    for (const [n, ar] of SPECIALTIES) specs.push(await db.specialty.create({ data: { clinicId: clinic.id, name: n!, nameAr: ar, description: `${n} care by board-certified fictional doctors.` } }));
    const services = [];
    for (const [si, s] of specs.entries()) {
      for (const [label, price] of [["Consultation", 300 + si * 40], ["Follow-up visit", 180 + si * 20]] as const) {
        const row = await db.service.create({ data: { clinicId: clinic.id, specialtyId: s.id, name: `${s.name} ${label}`, price: String(price), durationMin: label === "Consultation" ? 30 : 20 } });
        services.push({ id: row.id, price });
      }
    }
    await db.holiday.createMany({ data: [{ clinicId: clinic.id, date: new Date(dayStr(9) + "T00:00:00Z"), name: "Public holiday (demo)" }, { clinicId: clinic.id, date: new Date(dayStr(-20) + "T00:00:00Z"), name: "Clinic maintenance day" }] });
    await db.testimonial.createMany({ data: [{ clinicId: clinic.id, author: "Demo Patient A", quote: "Booking was quick and the staff were kind." }, { clinicId: clinic.id, author: "Demo Patient B", quote: "Short waiting time and clear explanations." }] });
    await db.faq.createMany({ data: [
      { clinicId: clinic.id, question: "How do I book an appointment?", answer: "Use the online booking page: choose a branch, specialty, doctor and an available time.", position: 1 },
      { clinicId: clinic.id, question: "Can I cancel or reschedule?", answer: "Yes, from the patient portal or by calling the branch.", position: 2 },
      { clinicId: clinic.id, question: "Which payment methods are accepted?", answer: "Cash, card, bank transfer and mobile wallet, recorded at the branch.", position: 3 },
    ] });

    // Staff accounts (employees)
    const dom = `${c.slug.split("-")[0]}.medora.test`;
    const staffDefs: [string, RoleKey, string, number][] = [["owner", "CLINIC_OWNER", "Clinic Owner", 1], ["manager", "BRANCH_MANAGER", "Branch Manager", c.branches.length], ["reception", "RECEPTIONIST", "Receptionist", c.branches.length], ["accountant", "ACCOUNTANT", "Accountant", 1], ["nurse", "NURSE", "Nurse", c.branches.length]];
    const employees: Prisma.EmployeeCreateManyInput[] = [];
    for (const [local, role, title, n] of staffDefs) {
      for (let i = 0; i < n; i++) {
        const branch = role === "CLINIC_OWNER" || role === "ACCOUNTANT" ? null : branches[i]!;
        const name = `${pick([...FIRST_M, ...FIRST_F])} ${pick(LAST)}`;
        const email = i === 0 ? `${local}@${dom}` : `${local}${i + 1}@${dom}`;
        const userId = addUser(name, email, role, clinic.id, branch?.id ?? null);
        employees.push({ clinicId: clinic.id, userId, branchId: branch?.id ?? null, fullName: name, jobTitle: title, phone: `+20 10${int(10000000, 99999999)}` });
        if (i === 0) summary.push(`${email} | ${role} | ${c.name}${branch ? " / " + branch.name : ""}`);
      }
    }
    // extra reception/support staff to reach 30 employees overall
    const extra = ci === 0 ? 4 : ci === 1 ? 3 : 2;
    for (let i = 0; i < extra; i++) {
      const name = `${pick([...FIRST_M, ...FIRST_F])} ${pick(LAST)}`;
      const userId = addUser(name, `support${i + 1}@${dom}`, "RECEPTIONIST", clinic.id, branches[i % branches.length]!.id);
      employees.push({ clinicId: clinic.id, userId, branchId: branches[i % branches.length]!.id, fullName: name, jobTitle: "Front desk assistant" });
    }
    await db.employee.createMany({ data: employees });

    // Doctors
    const doctors: (typeof clinicData)[number]["doctors"] = [];
    for (let i = 0; i < c.doctors; i++) {
      const female = chance(0.45);
      const name = `Dr. ${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
      const email = i === 0 ? `doctor@${dom}` : `doctor${i + 1}@${dom}`;
      const userId = addUser(name, email, "DOCTOR", clinic.id, null);
      if (i === 0) summary.push(`${email} | DOCTOR | ${c.name}`);
      const spec = specs[i % specs.length]!;
      const fee = 300 + (i % specs.length) * 40, commission = pick([20, 25, 30]);
      const dur = pick([20, 30]);
      const doc = await db.doctor.create({ data: { clinicId: clinic.id, userId, fullName: name, specialtyId: spec.id, bio: `${name} is a fictional ${spec.name} specialist.`, qualifications: "MBBCh, MSc (fictional)", yearsExperience: int(4, 25), consultationFee: String(fee), commissionPercent: String(commission), slotDurationMin: dur } });
      const multi = branches.length > 1 && i % 2 === 0;
      const sch: { branchId: string; weekday: number; start: string; end: string }[] = [];
      for (const wd of [0, 1, 2, 3, 4]) {
        const b = multi ? branches[wd % 2 === 0 ? 0 : 1]! : branches[i % branches.length]!;
        sch.push({ branchId: b.id, weekday: wd, start: "09:00", end: "17:00" });
      }
      await db.doctorSchedule.createMany({ data: sch.map((s) => ({ doctorId: doc.id, branchId: s.branchId, weekday: s.weekday, startTime: s.start, endTime: s.end, breakStart: "13:00", breakEnd: "13:30" })) });
      if (i === 1) await db.doctorVacation.create({ data: { doctorId: doc.id, startDate: new Date(dayStr(5) + "T00:00:00Z"), endDate: new Date(dayStr(7) + "T00:00:00Z"), reason: "Annual leave" } });
      doctors.push({ id: doc.id, userId, fee, commission, dur, schedules: sch });
    }

    // Patients
    const patients: Prisma.PatientCreateManyInput[] = [];
    for (let i = 0; i < c.patients; i++) {
      const female = chance(0.5);
      const first = pick(female ? FIRST_F : FIRST_M);
      patients.push({ id: uid(), clinicId: clinic.id, mrn: `P-${String(i + 1).padStart(6, "0")}`, fullName: `${first} ${pick(LAST)}`, gender: female ? "FEMALE" : "MALE",
        dateOfBirth: new Date(`${int(1950, 2020)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}T00:00:00Z`),
        phone: `+20 11${int(10000000, 99999999)}`, email: chance(0.6) ? `${first.toLowerCase()}${i}@example.test` : null, address: `${int(1, 120)} Demo Street, ${c.branches[0]![1]}`,
        emergencyContactName: `${pick(FIRST_M)} ${pick(LAST)}`, emergencyContactPhone: `+20 12${int(10000000, 99999999)}`, emergencyContactRelation: pick(["Spouse", "Parent", "Sibling", "Friend"]),
        allergies: chance(0.25) ? [pick(ALLERGIES)] : [], chronicConditions: chance(0.2) ? [pick(CHRONIC)] : [], medicalHistory: chance(0.3) ? "Fictional history entry for demonstration." : null,
        createdAt: new Date(now.getTime() - int(0, 400) * 86400000) });
    }
    // Demo patient portal account linked to the first patient
    const portalEmail = `patient@${dom}`;
    const portalUser = addUser(patients[0]!.fullName, portalEmail, "PATIENT", clinic.id, null);
    patients[0]!.userId = portalUser; patients[0]!.email = portalEmail;
    summary.push(`${portalEmail} | PATIENT | ${c.name}`);
    await db.patient.createMany({ data: patients });
    await db.counter.create({ data: { key: `mrn:${clinic.id}`, value: c.patients } });
    patients.forEach((p) => allPatients.push({ id: p.id!, clinicId: clinic.id, userId: p.userId ?? undefined }));

    // Expense categories + expenses
    const cats = [];
    for (const n of ["Rent", "Salaries", "Utilities", "Medical supplies", "Marketing"]) cats.push(await db.expenseCategory.create({ data: { clinicId: clinic.id, name: n } }));
    const exps: Prisma.ExpenseCreateManyInput[] = [];
    for (const b of branches) for (let m = 0; m < 3; m++) for (const [ki, cat] of cats.entries()) {
      const base = [3000, 4200, 600, 1200, 400][ki]!;
      exps.push({ clinicId: clinic.id, branchId: b.id, categoryId: cat.id, description: `${cat.name} - month -${m}`, amount: String(base + int(0, 1500)), incurredOn: new Date(dayStr(-m * 28 - int(1, 10)) + "T00:00:00Z") });
    }
    await db.expense.createMany({ data: exps });

    // Inventory
    const icat = await Promise.all(["Consumables", "Medication", "Diagnostics"].map((n) => db.inventoryCategory.create({ data: { clinicId: clinic.id, name: n } })));
    const suppliers = await Promise.all([1, 2, 3].map((n) => db.supplier.create({ data: { clinicId: clinic.id, name: `${["MedSupply", "CairoPharma", "NileLab"][n - 1]} Co. ${c.prefix}`, phone: `+20 2 ${int(2000, 2999)}${int(1000, 9999)}`, email: `sales${n}@supplier.test` } })));
    const itemNames = ["Disposable gloves (box)", "Syringes 5ml", "Surgical masks (box)", "Gauze rolls", "Alcohol swabs", "Paracetamol 500mg (strip)", "Cetirizine 10mg (strip)", "ORS sachets", "Glucose test strips", "Urine dipsticks", "Bandages", "Thermometer probe covers", "Lidocaine 2% vials", "Saline 500ml", "Adhesive tape"];
    const items = [];
    for (const [ii, n] of itemNames.entries()) items.push(await db.inventoryItem.create({ data: { clinicId: clinic.id, categoryId: icat[ii % 3]!.id, sku: `${c.prefix}-${String(ii + 1).padStart(3, "0")}`, name: n, unit: "unit", minStock: int(10, 40) } }));
    const batches: Prisma.InventoryBatchCreateManyInput[] = [];
    const moves: Prisma.StockMovementCreateManyInput[] = [];
    for (const it of items) for (const b of branches) {
      const nBatches = int(1, 2);
      for (let k = 0; k < nBatches; k++) {
        const low = chance(0.12);
        const qty = low ? int(0, 5) : int(30, 200);
        const expSoon = chance(0.1);
        const id = uid();
        batches.push({ id, itemId: it.id, branchId: b.id, batchNumber: `B${int(1000, 9999)}-${k}`, expiresOn: new Date(dayStr(expSoon ? int(5, 25) : int(120, 700)) + "T00:00:00Z"), quantity: qty });
        moves.push({ clinicId: clinic.id, itemId: it.id, batchId: id, branchId: b.id, type: "PURCHASE_RECEIPT", quantityDelta: qty, balanceAfter: qty, reason: "Opening stock (seed)" });
      }
    }
    await db.inventoryBatch.createMany({ data: batches });
    await db.stockMovement.createMany({ data: moves });
    const po = await db.purchaseOrder.create({ data: { clinicId: clinic.id, supplierId: suppliers[0]!.id, branchId: branches[0]!.id, number: `PO-${c.prefix}-0001`, status: "ORDERED", lines: { create: [{ itemId: items[0]!.id, quantity: 100, unitCost: "35.00", batchNumber: "PO-SEED-1", expiresOn: new Date(dayStr(500) + "T00:00:00Z") }] } } });
    void po;

    clinicData.push({ id: clinic.id, branches, doctors, patientIds: patients.map((p) => p.id!), services, tz: TZ, tax: c.tax, prefix: c.prefix });
  }

  await db.user.createMany({ data: users });
  await db.account.createMany({ data: accounts });
  await db.membership.createMany({ data: memberships });
  console.log(`Users: ${users.length}`);

  // Link: userId of doctors/employees done at creation (FK to user created after) -> need users first. Handled below by re-linking.
  await seedActivity({ clinicData, now, dayStr, wdOf, today });
  console.log(`Seed finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('\nDemo accounts (password for ALL: ' + DEMO_PASSWORD + ')\n' + summary.join('\n'));
}


type ClinicData = {
  id: string; branches: { id: string }[]; patientIds: string[]; services: { id: string; price: number }[]; tax: string; prefix: string;
  doctors: { id: string; userId: string; fee: number; commission: number; dur: number; schedules: { branchId: string; weekday: number; start: string; end: string }[] }[];
};

const PATHS: Record<string, AppointmentStatus[]> = {
  PENDING: ["PENDING"], CONFIRMED: ["PENDING", "CONFIRMED"], CANCELLED: ["PENDING", "CONFIRMED", "CANCELLED"], NO_SHOW: ["PENDING", "CONFIRMED", "NO_SHOW"],
  CHECKED_IN: ["PENDING", "CONFIRMED", "CHECKED_IN"], WAITING: ["PENDING", "CONFIRMED", "CHECKED_IN", "WAITING"],
  IN_PROGRESS: ["PENDING", "CONFIRMED", "CHECKED_IN", "WAITING", "IN_PROGRESS"], COMPLETED: ["PENDING", "CONFIRMED", "CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED"],
};
const REF = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const mkRef = () => "MED-" + Array.from({ length: 8 }, () => REF[Math.floor(rnd() * REF.length)]).join("");

async function seedActivity(a: { clinicData: ClinicData[]; now: Date; dayStr: (n: number) => string; wdOf: (s: string) => number; today: string }) {
  const { now, dayStr, wdOf } = a;
  const holidays = new Set([dayStr(9), dayStr(-20)]);
  const targets = [450, 330, 220];
  const year = now.getUTCFullYear();
  let totalAppts = 0, totalInv = 0, totalPay = 0;

  for (const [ci, c] of a.clinicData.entries()) {
    const used = new Set<string>();
    const refs = new Set<string>();
    const appts: Prisma.AppointmentCreateManyInput[] = [];
    const hist: Prisma.AppointmentStatusHistoryCreateManyInput[] = [];
    const cons: Prisma.ConsultationCreateManyInput[] = [];
    const rxs: Prisma.PrescriptionCreateManyInput[] = [];
    const rxItems: Prisma.PrescriptionItemCreateManyInput[] = [];
    const invoices: Prisma.InvoiceCreateManyInput[] = [];
    const invItems: Prisma.InvoiceItemCreateManyInput[] = [];
    const payments: Prisma.PaymentCreateManyInput[] = [];
    const refunds: Prisma.RefundCreateManyInput[] = [];
    const commissions: Prisma.CommissionCreateManyInput[] = [];
    const registers = new Map<string, { id: string; branchId: string; date: string; cash: number }>();
    const queue = new Map<string, number>();
    let invN = 0, rctN = 0, rxN = 0, guard = 0;
    const pending: { appt: Prisma.AppointmentCreateManyInput; doctor: ClinicData["doctors"][number]; date: string }[] = [];

    while (pending.length < targets[ci]! && guard++ < 200000) {
      const doctor = pick(c.doctors);
      const off = chance(0.07) ? 0 : int(-60, 14);
      const date = dayStr(off);
      if (holidays.has(date)) continue;
      if (doctor === c.doctors[1] && off >= 5 && off <= 7) continue;
      const sch = doctor.schedules.find((s) => s.weekday === wdOf(date));
      if (!sch) continue;
      const slots: number[] = [];
      for (let t = toMinutes(sch.start); t + doctor.dur <= toMinutes(sch.end); t += doctor.dur) if (!(t < toMinutes("13:30") && t + doctor.dur > toMinutes("13:00"))) slots.push(t);
      const t = pick(slots);
      const startsAt = zonedToUtc(date, fromMinutes(t), "Africa/Cairo");
      const key = doctor.id + startsAt.toISOString();
      if (used.has(key)) continue;
      used.add(key);
      const endsAt = new Date(startsAt.getTime() + doctor.dur * 60000);
      let status: AppointmentStatus;
      if (endsAt < now) { const r = rnd(); status = r < 0.78 ? "COMPLETED" : r < 0.88 ? "CANCELLED" : "NO_SHOW"; }
      else if (startsAt > now) { const r = rnd(); status = r < 0.08 ? "CANCELLED" : r < 0.5 ? "PENDING" : "CONFIRMED"; }
      else status = pick(["IN_PROGRESS", "WAITING", "CHECKED_IN"]);
      if (off === 0 && startsAt < now && endsAt >= now && chance(0.2)) status = "IN_PROGRESS";
      let ref = mkRef(); while (refs.has(ref)) ref = mkRef(); refs.add(ref);
      pending.push({ date, doctor, appt: { id: uid(), clinicId: c.id, branchId: sch.branchId, doctorId: doctor.id, patientId: pick(c.patientIds), serviceId: chance(0.3) ? pick(c.services).id : null, reference: ref, startsAt, endsAt, status,
        source: pick(["ONLINE", "RECEPTION", "RECEPTION", "WALK_IN", "PORTAL"]), reason: pick(["Check-up", "Follow-up", "Pain", "Fever", "Skin rash", "Blood pressure review", null]), createdAt: new Date(startsAt.getTime() - int(1, 10) * 86400000) } });
    }
    pending.sort((x, y) => +x.appt.startsAt! - +y.appt.startsAt!);

    for (const { appt, doctor, date } of pending) {
      const st = appt.status as AppointmentStatus;
      if (date === a.today && ["CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED"].includes(st)) {
        const qk = appt.branchId!; const n = (queue.get(qk) ?? 0) + 1; queue.set(qk, n);
        appt.queueNumber = n; appt.queueDate = new Date(date + "T00:00:00Z"); appt.checkedInAt = new Date((appt.startsAt as Date).getTime() - 10 * 60000);
      } else if (["CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED"].includes(st)) appt.checkedInAt = new Date((appt.startsAt as Date).getTime() - 10 * 60000);
      if (st === "COMPLETED") appt.completedAt = appt.endsAt;
      if (st === "CANCELLED") appt.cancelReason = pick(["Patient request", "Doctor unavailable", "Scheduling conflict"]);
      appts.push(appt);
      const path = PATHS[st]!;
      path.forEach((to, k) => hist.push({ appointmentId: appt.id!, fromStatus: k ? path[k - 1] : null, toStatus: to, note: k ? null : "Created", createdAt: new Date((appt.startsAt as Date).getTime() - (path.length - k) * 3600000) }));

      if (st === "COMPLETED") {
        const consId = uid();
        cons.push({ id: consId, appointmentId: appt.id!, clinicId: c.id, patientId: appt.patientId!, doctorId: doctor.id, complaint: appt.reason, clinicalNotes: "Fictional clinical note for demonstration.",
          vitals: { bpSystolic: int(105, 150), bpDiastolic: int(65, 95), heartRate: int(58, 104), tempC: +(36 + rnd() * 1.5).toFixed(1), weightKg: int(50, 110), spo2: int(94, 100) },
          diagnosis: pick(DIAGNOSES), treatmentPlan: "Rest, hydration, follow-up if symptoms persist.", completedAt: appt.endsAt as Date });
        if (chance(0.35)) {
          const rid = uid(); rxN++;
          rxs.push({ id: rid, clinicId: c.id, consultationId: consId, patientId: appt.patientId!, doctorId: doctor.id, number: `RX-${c.id.slice(-4).toUpperCase()}-${String(rxN).padStart(6, "0")}`, issuedAt: appt.endsAt as Date });
          const m = pick(MEDS); rxItems.push({ prescriptionId: rid, medication: m[0]!, dosage: m[1]!, frequency: m[2]!, duration: m[3]!, instructions: "Take after meals." });
        }
        // Invoice
        const lines = [{ description: "Consultation", quantity: 1, unitPrice: doctor.fee }];
        if (appt.serviceId) lines.push({ description: "Additional service", quantity: 1, unitPrice: c.services.find((s) => s.id === appt.serviceId)!.price });
        const disc = chance(0.1) ? 50 : 0;
        const tot = computeInvoiceTotals(lines, disc, c.tax);
        const invId = uid(); invN++;
        const r = rnd();
        let paid = D(0);
        if (r < 0.7) paid = tot.total; else if (r < 0.85) paid = tot.total.div(2).toDecimalPlaces(2);
        const status = paid.eq(tot.total) ? "PAID" : paid.gt(0) ? "PARTIALLY_PAID" : "ISSUED";
        invoices.push({ id: invId, clinicId: c.id, branchId: appt.branchId!, patientId: appt.patientId!, appointmentId: appt.id!, number: `${c.prefix}-${year}-${String(invN).padStart(6, "0")}`, status, currency: "EGP",
          subtotal: tot.subtotal.toString(), discountAmount: tot.discountAmount.toString(), taxAmount: tot.taxAmount.toString(), total: tot.total.toString(), paidAmount: paid.toString(), issuedAt: appt.endsAt as Date });
        lines.forEach((l, i) => invItems.push({ invoiceId: invId, description: l.description, quantity: l.quantity, unitPrice: String(l.unitPrice), lineTotal: tot.lineTotals[i]!.toString() }));
        if (paid.gt(0)) {
          const method = pick<PaymentMethod>(["CASH", "CASH", "CARD", "CARD", "BANK_TRANSFER", "MOBILE_WALLET"]);
          const payId = uid(); rctN++;
          let regId: string | null = null;
          if (method === "CASH") {
            const rk = appt.branchId + date;
            if (!registers.has(rk)) registers.set(rk, { id: uid(), branchId: appt.branchId!, date, cash: 0 });
            const reg = registers.get(rk)!; reg.cash += Number(paid); regId = reg.id;
          }
          payments.push({ id: payId, invoiceId: invId, clinicId: c.id, amount: paid.toString(), method, reference: method === "BANK_TRANSFER" ? `TRX${int(100000, 999999)}` : null, idempotencyKey: `seed-${payId}`, receiptNumber: `RCT-${String(rctN).padStart(6, "0")}`, cashRegisterId: regId, paidAt: new Date((appt.endsAt as Date).getTime() + 5 * 60000) });
          let net = paid;
          if (status === "PAID" && chance(0.03)) {
            const ra = D(50);
            refunds.push({ paymentId: payId, clinicId: c.id, amount: ra.toString(), reason: "Service adjustment (demo)", idempotencyKey: `seed-refund-${payId}`, createdAt: new Date((appt.endsAt as Date).getTime() + 3600000) });
            const inv = invoices[invoices.length - 1]!; inv.refundedAmount = ra.toString(); inv.status = "PARTIALLY_PAID"; net = paid.sub(ra);
          }
          commissions.push({ clinicId: c.id, doctorId: doctor.id, invoiceId: invId, percent: String(doctor.commission), amount: net.mul(doctor.commission).div(100).toDecimalPlaces(2).toString(), createdAt: new Date((appt.endsAt as Date).getTime() + 5 * 60000) });
        }
      }
    }

    // Close past registers
    const regRows = [...registers.values()].map((r) => {
      const closed = r.date < a.today;
      return { id: r.id, clinicId: c.id, branchId: r.branchId, businessDate: new Date(r.date + "T00:00:00Z"), openingBalance: "0", expectedCash: closed ? String(r.cash) : null, countedCash: closed ? String(r.cash) : null, closedAt: closed ? new Date(r.date + "T20:00:00Z") : null };
    });
    await db.appointment.createMany({ data: appts });
    await db.appointmentStatusHistory.createMany({ data: hist });
    await db.consultation.createMany({ data: cons });
    await db.prescription.createMany({ data: rxs });
    await db.prescriptionItem.createMany({ data: rxItems });
    await db.invoice.createMany({ data: invoices });
    await db.invoiceItem.createMany({ data: invItems });
    await db.cashRegister.createMany({ data: regRows });
    await db.payment.createMany({ data: payments });
    await db.refund.createMany({ data: refunds });
    await db.commission.createMany({ data: commissions });
    await db.counter.createMany({ data: [{ key: `invoice:${c.id}:${year}`, value: invN }, { key: `receipt:${c.id}`, value: rctN }, { key: `rx:${c.id}`, value: rxN }] });

    // Notifications for managers/owners/accountants
    const staff = await db.membership.findMany({ where: { clinicId: c.id, role: { key: { in: ["CLINIC_OWNER", "BRANCH_MANAGER", "ACCOUNTANT", "RECEPTIONIST"] } } }, select: { userId: true } });
    const types = [["APPOINTMENT_NEW", "New appointment", "A patient booked online."], ["INVOICE_OUTSTANDING", "Outstanding invoices", "Several invoices have an open balance."], ["INVENTORY_LOW", "Low stock", "Some items are below minimum stock."], ["ADMIN_EVENT", "Welcome to Medora", "Demo notification."]] as const;
    await db.notification.createMany({ data: staff.flatMap((s) => types.map(([t, title, body], i) => ({ clinicId: c.id, userId: s.userId, type: t, title, body, readAt: i === 3 ? new Date() : null, createdAt: new Date(now.getTime() - i * 3600000) }))) });
    totalAppts += appts.length; totalInv += invoices.length; totalPay += payments.length;
    console.log(`Clinic ${ci + 1}: ${appts.length} appointments, ${invoices.length} invoices, ${payments.length} payments`);
  }
  // Platform notification-free audit sample
  await db.auditLog.create({ data: { action: "seed.run", entity: "System", metadata: { appointments: totalAppts, invoices: totalInv, payments: totalPay } } });
  console.log(`Totals: ${totalAppts} appointments, ${totalInv} invoices, ${totalPay} payments`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
