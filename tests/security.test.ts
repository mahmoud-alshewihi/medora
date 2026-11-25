import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { requireAccess, requirePlatformAdmin } from "@/server/auth/access";
import { bookAppointment, changeStatus } from "@/server/appointments/service";
import { canAccessMedical, getPatientProfile, registerPatient, searchPatients, updatePatient, exportPatientsCsv, importPatientsCsv } from "@/server/patients/service";
import { createInvoice } from "@/server/billing/service";
import { portalBook, portalCancel, portalOverview, portalReschedule } from "@/server/portal/service";
import { setClinicStatus, enforcePlanLimit } from "@/server/platform/service";
import { at, futureDate, makeClinic, type World } from "./helpers";

let A: World, B: World;
beforeAll(async () => { A = await makeClinic("Alpha"); B = await makeClinic("Beta"); });

describe("role permissions enforced server-side", () => {
  it("unauthenticated -> 401", async () => {
    await expect(requireAccess("patient.read", { ctx: null })).rejects.toMatchObject({ status: 401 });
  });
  it("receptionist cannot use accountant/medical/inventory-adjust permissions", async () => {
    for (const p of ["medical.read", "refund.create", "expense.manage", "inventory.adjust", "reports.view", "staff.manage"] as const)
      await expect(requireAccess(p, { ctx: A.ctxs.receptionist })).rejects.toMatchObject({ status: 403 });
    await expect(requireAccess("patient.write", { ctx: A.ctxs.receptionist })).resolves.toBeTruthy();
  });
  it("accountant cannot read medical records or manage appointments", async () => {
    await expect(requireAccess("medical.read", { ctx: A.ctxs.accountant })).rejects.toMatchObject({ status: 403 });
    await expect(requireAccess("appointment.write", { ctx: A.ctxs.accountant })).rejects.toMatchObject({ status: 403 });
    await expect(requireAccess("refund.create", { ctx: A.ctxs.accountant })).resolves.toBeTruthy();
  });
  it("patients get no staff permissions", async () => {
    await expect(requireAccess("patient.read", { ctx: A.ctxs.patient })).rejects.toMatchObject({ status: 403 });
    await expect(requireAccess("portal.self", { ctx: A.ctxs.patient })).resolves.toBeTruthy();
  });
  it("super admin is not granted clinic data or medical access", async () => {
    await expect(requireAccess("medical.read", { ctx: A.ctxs.superAdmin })).rejects.toMatchObject({ status: 403 });
    await expect(requireAccess("patient.read", { ctx: A.ctxs.superAdmin })).rejects.toMatchObject({ status: 403 });
    await expect(requirePlatformAdmin(A.ctxs.superAdmin)).resolves.toBeTruthy();
    await expect(requirePlatformAdmin(A.ctxs.owner)).rejects.toMatchObject({ status: 403 });
  });
});

describe("tenant isolation / IDOR", () => {
  it("clinic A staff cannot read clinic B patient by id", async () => {
    await expect(getPatientProfile(A.ctxs.owner, B.patient.id)).rejects.toMatchObject({ status: 404 });
  });
  it("cannot update a patient of another clinic", async () => {
    await expect(updatePatient(A.ctxs.owner, B.patient.id, { fullName: "Hacked Name" })).rejects.toMatchObject({ status: 404 });
    expect((await db.patient.findUniqueOrThrow({ where: { id: B.patient.id } })).fullName).toBe("Pat Ient");
  });
  it("search never leaks other tenants", async () => {
    const r = await searchPatients(A.clinic.id, { page: 1, pageSize: 100, sort: "createdAt", dir: "desc", archived: "false" });
    expect(r.rows.every((x) => x.id !== B.patient.id && x.id !== B.patient2.id)).toBe(true);
    expect(r.total).toBe(2);
  });
  it("cannot change status of another clinic's appointment", async () => {
    const ap = await bookAppointment({ clinicId: B.clinic.id, branchId: B.b1.id, doctorId: B.doctor.id, patientId: B.patient.id, startsAt: at(futureDate(5), "10:00"), source: "RECEPTION" });
    await expect(changeStatus({ clinicId: A.clinic.id, appointmentId: ap.id, to: "CANCELLED" })).rejects.toMatchObject({ status: 404 });
  });
  it("cannot book with another clinic's doctor or branch", async () => {
    await expect(bookAppointment({ clinicId: A.clinic.id, branchId: A.b1.id, doctorId: B.doctor.id, patientId: A.patient.id, startsAt: at(futureDate(5), "11:00"), source: "RECEPTION" })).rejects.toMatchObject({ status: 404 });
    await expect(bookAppointment({ clinicId: A.clinic.id, branchId: B.b1.id, doctorId: A.doctor.id, patientId: A.patient.id, startsAt: at(futureDate(5), "11:00"), source: "RECEPTION" })).rejects.toMatchObject({ status: 404 });
  });
  it("branch-restricted staff cannot touch another branch's appointment", async () => {
    const ap = await bookAppointment({ clinicId: A.clinic.id, branchId: A.b2.id, doctorId: A.doctor.id, patientId: A.patient.id, startsAt: at(futureDate(6), "10:00"), source: "RECEPTION" });
    await expect(changeStatus({ clinicId: A.clinic.id, appointmentId: ap.id, to: "CANCELLED", branchId: A.ctxs.receptionist.branchId })).rejects.toMatchObject({ status: 404 });
  });
});

describe("medical record access", () => {
  it("doctor only sees patients they have appointments with", async () => {
    expect(await canAccessMedical(A.ctxs.doctor, A.patient2.id)).toBe(false);
    await bookAppointment({ clinicId: A.clinic.id, branchId: A.b1.id, doctorId: A.doctor.id, patientId: A.patient2.id, startsAt: at(futureDate(8), "10:00"), source: "RECEPTION" });
    expect(await canAccessMedical(A.ctxs.doctor, A.patient2.id)).toBe(true);
  });
  it("another clinic's doctor never has access", async () => {
    expect(await canAccessMedical(B.ctxs.doctor, A.patient.id)).toBe(false);
  });
  it("receptionist/accountant/manager profile omits medical data", async () => {
    await db.patient.update({ where: { id: A.patient.id }, data: { medicalHistory: "secret history", allergies: ["Penicillin"] } });
    for (const who of ["receptionist", "accountant", "manager"] as const) {
      const p = await getPatientProfile(A.ctxs[who], A.patient.id);
      expect(p.medicalAccess).toBe(false);
      expect(JSON.stringify(p)).not.toContain("secret history");
      expect(p).not.toHaveProperty("allergies");
    }
  });
  it("receptionist cannot edit medical fields", async () => {
    await expect(updatePatient(A.ctxs.receptionist, A.patient.id, { medicalHistory: "x" })).rejects.toMatchObject({ status: 403 });
  });
  it("nurse is limited to patients at their branch", async () => {
    expect(await canAccessMedical(A.ctxs.nurse, A.patient.id)).toBe(false);
    await bookAppointment({ clinicId: A.clinic.id, branchId: A.b1.id, doctorId: A.doctor.id, patientId: A.patient.id, startsAt: at(futureDate(9), "09:00"), source: "RECEPTION" });
    expect(await canAccessMedical(A.ctxs.nurse, A.patient.id)).toBe(true);
  });
  it("owner of the clinic sees medical data and the read is audited", async () => {
    const p = await getPatientProfile(A.ctxs.owner, A.patient.id);
    expect(p.medicalAccess).toBe(true);
    expect(await db.auditLog.count({ where: { clinicId: A.clinic.id, action: "medical.read", entityId: A.patient.id } })).toBeGreaterThan(0);
  });
});

describe("patient portal isolation", () => {
  it("only returns the signed-in patient's own data", async () => {
    await bookAppointment({ clinicId: A.clinic.id, branchId: A.b1.id, doctorId: A.doctor.id, patientId: A.patient2.id, startsAt: at(futureDate(10), "10:00"), source: "RECEPTION" });
    await createInvoice({ clinicId: A.clinic.id, branchId: A.b1.id, patientId: A.patient2.id, items: [{ description: "x", quantity: 1, unitPrice: "10" }] });
    const o = await portalOverview(A.ctxs.patient);
    expect(o.patient.id).toBe(A.patient.id);
    expect(o.appointments.every((a) => a.patientId === A.patient.id)).toBe(true);
    expect(o.invoices.every((i) => i.patientId === A.patient.id)).toBe(true);
  });
  it("cannot cancel or reschedule someone else's appointment", async () => {
    const other = await db.appointment.findFirstOrThrow({ where: { patientId: A.patient2.id, clinicId: A.clinic.id } });
    await expect(portalCancel(A.ctxs.patient, other.id)).rejects.toMatchObject({ status: 404 });
    await expect(portalReschedule(A.ctxs.patient, other.id, at(futureDate(10), "12:00"))).rejects.toMatchObject({ status: 404 });
  });
  it("can book, then cancel their own appointment", async () => {
    const a = await portalBook(A.ctxs.patient, { branchId: A.b1.id, doctorId: A.doctor.id, startsAt: at(futureDate(11), "10:00") });
    expect(a.status).toBe("PENDING");
    const c = await portalCancel(A.ctxs.patient, a.id);
    expect(c.status).toBe("CANCELLED");
  });
  it("a staff account without a linked patient cannot use the portal", async () => {
    await expect(portalOverview(A.ctxs.owner)).rejects.toMatchObject({ status: 403 });
  });
});

describe("subscription restrictions", () => {
  it("expired subscription is read-only on the server", async () => {
    const E = await makeClinic("Exp", { subscription: "EXPIRED" });
    await expect(requireAccess("patient.read", { ctx: E.ctxs.owner })).resolves.toBeTruthy();
    await expect(requireAccess("patient.write", { ctx: E.ctxs.owner, write: true })).rejects.toMatchObject({ code: "SUBSCRIPTION_EXPIRED", status: 402 });
  });
  it("suspended clinic is blocked entirely", async () => {
    const S = await makeClinic("Susp");
    await setClinicStatus(S.clinic.id, "SUSPENDED", S.users.superAdmin.id);
    await expect(requireAccess("patient.read", { ctx: S.ctxs.owner })).rejects.toMatchObject({ code: "CLINIC_SUSPENDED" });
    await setClinicStatus(S.clinic.id, "ACTIVE", S.users.superAdmin.id);
    await expect(requireAccess("patient.read", { ctx: S.ctxs.owner })).resolves.toBeTruthy();
  });
  it("enforces plan usage limits", async () => {
    const L = await makeClinic("Lim", { planMaxPatients: 3 });
    await expect(enforcePlanLimit(L.clinic.id, "patients")).resolves.toBeUndefined(); // 2 of 3 used
    await registerPatient(L.clinic.id, { fullName: "Third Patient" });
    await expect(registerPatient(L.clinic.id, { fullName: "Fourth Patient" })).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED", status: 402 });
  });
});

describe("patient registration, search, CSV", () => {
  it("registers with unique sequential MRN", async () => {
    const a = await registerPatient(A.clinic.id, { fullName: "New Person One", phone: "+20111111111" });
    const b = await registerPatient(A.clinic.id, { fullName: "New Person Two" });
    expect(a.mrn).toMatch(/^P-\d{6}$/);
    expect(a.mrn).not.toBe(b.mrn);
    const found = await searchPatients(A.clinic.id, { q: "Person Two", page: 1, pageSize: 10, sort: "fullName", dir: "asc", archived: "false" });
    expect(found.total).toBe(1);
  });
  it("imports valid CSV rows, reports bad rows, and exports without formula injection", async () => {
    const csv = 'fullName,phone,email\nImported One,+20100000001,a@example.test\nX,12,notanemail\n"=CMD|calc",+20100000002,\n';
    const r = await importPatientsCsv(A.ctxs.owner, csv);
    expect(r.created).toBe(2); // 'Imported One' and the formula-looking name (stored, neutralised on export)
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.row).toBe(3);
    const out = await exportPatientsCsv(A.ctxs.owner);
    expect(out).toContain("Imported One");
    expect(out).not.toMatch(/(^|,)=CMD/m);
  });
});
