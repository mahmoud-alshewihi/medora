import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { bookAppointment, changeStatus } from "@/server/appointments/service";
import { completeConsultation, createPrescription, requestLab, saveConsultation, startConsultation } from "@/server/clinical/service";
import { recordPayment } from "@/server/billing/service";
import { dashboard, fullReport } from "@/server/reports/service";
import { getPatientProfile } from "@/server/patients/service";
import { portalOverview } from "@/server/portal/service";
import { todayIn } from "@/lib/tz";
import { at, futureDate, makeClinic, type World } from "./helpers";

let w: World;
beforeAll(async () => { w = await makeClinic("Flow"); });

describe("end-to-end clinical + financial workflow (service level)", () => {
  it("booking -> check-in -> consultation -> prescription -> complete -> invoice -> payment -> reports/profile/portal", async () => {
    const date = futureDate(2);
    const ap = await bookAppointment({ clinicId: w.clinic.id, branchId: w.b1.id, doctorId: w.doctor.id, patientId: w.patient.id, startsAt: at(date, "10:00"), source: "RECEPTION" });
    await changeStatus({ clinicId: w.clinic.id, appointmentId: ap.id, to: "CHECKED_IN" });
    // doctor of a different clinic cannot open it
    const other = await makeClinic("FlowOther");
    await expect(startConsultation(other.ctxs.doctor, ap.id)).rejects.toMatchObject({ status: 404 });
    const c = await startConsultation(w.ctxs.doctor, ap.id);
    await expect(completeConsultation(w.ctxs.doctor, c.id)).rejects.toMatchObject({ status: 400 }); // diagnosis required
    await saveConsultation(w.ctxs.doctor, c.id, { diagnosis: "Seasonal rhinitis", treatmentPlan: "Antihistamine", vitals: { heartRate: 72, bpSystolic: 120, bpDiastolic: 80 }, followUpDate: date });
    await expect(saveConsultation(w.ctxs.doctor, c.id, { vitals: { heartRate: 9999 } as never })).rejects.toBeTruthy();
    const rx = await createPrescription(w.ctxs.doctor, c.id, { items: [{ medication: "Cetirizine 10mg", dosage: "1 tablet", frequency: "Once daily", duration: "10 days" }] });
    expect(rx.number).toMatch(/^RX-/);
    await requestLab(w.ctxs.doctor, c.id, "CBC");
    const done = await completeConsultation(w.ctxs.doctor, c.id);
    expect(done.invoiceId).toBeTruthy();
    expect((await db.appointment.findUniqueOrThrow({ where: { id: ap.id } })).status).toBe("COMPLETED");
    await expect(saveConsultation(w.ctxs.doctor, c.id, { diagnosis: "changed" })).rejects.toMatchObject({ code: "CONSULTATION_COMPLETED" });

    const inv = await db.invoice.findUniqueOrThrow({ where: { id: done.invoiceId! } });
    expect(inv.total.toFixed(2)).toBe("400.00");
    await recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "400", method: "CASH", idempotencyKey: "flow-pay-0001" });

    const commission = await db.commission.findFirstOrThrow({ where: { invoiceId: inv.id } });
    expect(commission.amount.toFixed(2)).toBe("100.00"); // 25% of 400

    // everything shows up in the connected views
    const profile = await getPatientProfile(w.ctxs.owner, w.patient.id);
    expect((profile.billing as { invoices: unknown[] }).invoices).toHaveLength(1);
    expect((profile.records as unknown[]).length).toBe(1);
    expect((profile.prescriptions as unknown[]).length).toBe(1);
    const portal = await portalOverview(w.ctxs.patient);
    expect(portal.prescriptions).toHaveLength(1);
    expect(portal.invoices[0]!.status).toBe("PAID");
    expect(portal.outstanding).toBe("0.00");

    const today = todayIn("Africa/Cairo");
    const f = { from: futureDate(-1) < today ? futureDate(-1) : today, to: futureDate(3) };
    const rep = await fullReport(w.ctxs.owner, f);
    expect(rep.financial.revenue).toBe("400.00");
    expect(rep.appointments.completed).toBe(1);
    expect(rep.commissions[0]!.commission).toBe("100.00");
    expect(rep.methods[0]).toMatchObject({ method: "CASH", amount: "400.00" });
    const dash = await dashboard(w.ctxs.owner, f);
    expect(dash.kpis.monthlyRevenue).toBe("400.00");
    expect(dash.kpis.outstanding).toBe("0.00");
    expect(dash.kpis.totalPatients).toBe(2);
    // tenant isolation in reports
    const otherRep = await fullReport(other.ctxs.owner, f);
    expect(otherRep.financial.revenue).toBe("0.00");
  });
});
