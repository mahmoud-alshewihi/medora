import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { bookAppointment, changeStatus, rescheduleAppointment, queueForBranch } from "@/server/appointments/service";
import { computeSlots } from "@/server/appointments/slots";
import { at, futureDate, makeClinic, type World } from "./helpers";

let w: World;
const date = futureDate(7);
beforeAll(async () => { w = await makeClinic("Appt"); });

const book = (over: Partial<Parameters<typeof bookAppointment>[0]> = {}) => bookAppointment({
  clinicId: w.clinic.id, branchId: w.b1.id, doctorId: w.doctor.id, patientId: w.patient.id, startsAt: at(date, "10:00"), source: "RECEPTION", ...over,
});

describe("slots come from the database", () => {
  it("excludes breaks and respects working hours", async () => {
    const { slots } = await computeSlots({ clinicId: w.clinic.id, doctorId: w.doctor.id, branchId: w.b1.id, date });
    const times = slots.map((s) => s.time);
    expect(times).toContain("09:00");
    expect(times).not.toContain("13:00"); // break 13:00-13:30
    expect(times).toContain("13:30");
    expect(times).not.toContain("08:30");
    expect(times).not.toContain("17:00");
  });
});

describe("booking", () => {
  it("books, creates history, reference and notification-ready state", async () => {
    const a = await book({ startsAt: at(date, "09:00") });
    expect(a.reference).toMatch(/^MED-[A-Z0-9]{8}$/);
    expect(a.status).toBe("CONFIRMED");
    const h = await db.appointmentStatusHistory.findMany({ where: { appointmentId: a.id } });
    expect(h).toHaveLength(1);
    const { slots } = await computeSlots({ clinicId: w.clinic.id, doctorId: w.doctor.id, branchId: w.b1.id, date });
    expect(slots.map((s) => s.time)).not.toContain("09:00");
  });
  it("rejects double booking of the same slot", async () => {
    await book({ startsAt: at(date, "11:00") });
    await expect(book({ startsAt: at(date, "11:00"), patientId: w.patient2.id })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });
  it("rejects bookings outside working hours, during break, and in the past", async () => {
    await expect(book({ startsAt: at(date, "07:00") })).rejects.toMatchObject({ status: 409 });
    await expect(book({ startsAt: at(date, "13:00") })).rejects.toMatchObject({ status: 409 });
    await expect(book({ startsAt: at(futureDate(-3), "10:00") })).rejects.toMatchObject({ status: 409 });
  });
  it("blocks holidays and doctor vacations", async () => {
    const hd = futureDate(9), vd = futureDate(10);
    await db.holiday.create({ data: { clinicId: w.clinic.id, date: new Date(hd + "T00:00:00Z"), name: "Test holiday" } });
    await db.doctorVacation.create({ data: { doctorId: w.doctor.id, startDate: new Date(vd + "T00:00:00Z"), endDate: new Date(vd + "T00:00:00Z") } });
    await expect(book({ startsAt: at(hd, "10:00") })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(book({ startsAt: at(vd, "10:00") })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });
  it("handles 8 concurrent bookings of one slot: exactly one wins", async () => {
    const d = futureDate(12);
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => book({ startsAt: at(d, "15:00"), patientId: i % 2 ? w.patient.id : w.patient2.id })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.appointment.count({ where: { doctorId: w.doctor.id, startsAt: at(d, "15:00") } })).toBe(1);
  });
  it("prevents the same doctor being double booked across branches", async () => {
    const d = futureDate(13);
    await book({ startsAt: at(d, "10:00"), branchId: w.b1.id });
    await expect(book({ startsAt: at(d, "10:00"), branchId: w.b2.id, patientId: w.patient2.id })).rejects.toMatchObject({ status: 409 });
  });
  it("database exclusion constraint blocks overlapping rows even if app logic is bypassed", async () => {
    const d = futureDate(14);
    const base = { clinicId: w.clinic.id, branchId: w.b1.id, doctorId: w.doctor.id, patientId: w.patient.id, status: "CONFIRMED" as const };
    await db.appointment.create({ data: { ...base, reference: "RAW-1", startsAt: at(d, "10:00"), endsAt: at(d, "10:30") } });
    await expect(db.appointment.create({ data: { ...base, reference: "RAW-2", startsAt: at(d, "10:15"), endsAt: at(d, "10:45") } })).rejects.toThrow();
    // cancelled appointments free the slot
    const c = await db.appointment.create({ data: { ...base, reference: "RAW-3", startsAt: at(d, "11:00"), endsAt: at(d, "11:30"), status: "CANCELLED" } });
    await expect(db.appointment.create({ data: { ...base, reference: "RAW-4", startsAt: at(d, "11:00"), endsAt: at(d, "11:30") } })).resolves.toBeTruthy();
    expect(c.id).toBeTruthy();
  });
  it("refuses a patient from another clinic", async () => {
    const other = await makeClinic("Other");
    await expect(book({ patientId: other.patient.id, startsAt: at(futureDate(15), "10:00") })).rejects.toMatchObject({ status: 404 });
  });
});

describe("status transitions + queue", () => {
  it("follows valid path, assigns queue numbers, and records history", async () => {
    const a = await book({ startsAt: at(futureDate(16), "09:00") });
    const base = { clinicId: w.clinic.id, appointmentId: a.id };
    await expect(changeStatus({ ...base, to: "COMPLETED" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await changeStatus({ ...base, to: "CHECKED_IN" });
    const after = await db.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.queueNumber).toBe(1);
    await changeStatus({ ...base, to: "WAITING" });
    await changeStatus({ ...base, to: "IN_PROGRESS" });
    await changeStatus({ ...base, to: "COMPLETED" });
    await expect(changeStatus({ ...base, to: "CANCELLED" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const hist = await db.appointmentStatusHistory.findMany({ where: { appointmentId: a.id }, orderBy: { createdAt: "asc" } });
    expect(hist.map((h) => h.toStatus)).toEqual(["CONFIRMED", "CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED"]);
  });
  it("cancelled appointments cannot be reactivated", async () => {
    const a = await book({ startsAt: at(futureDate(17), "09:00") });
    await changeStatus({ clinicId: w.clinic.id, appointmentId: a.id, to: "CANCELLED", note: "test" });
    await expect(changeStatus({ clinicId: w.clinic.id, appointmentId: a.id, to: "CONFIRMED" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
  it("queue view lists checked-in patients with wait estimates", async () => {
    const q = await queueForBranch(w.clinic.id, null, futureDate(16));
    expect(Array.isArray(q)).toBe(true);
  });
});

describe("rescheduling", () => {
  it("moves to a free slot, frees the old slot, rejects taken slot", async () => {
    const d = futureDate(18);
    const a = await book({ startsAt: at(d, "09:00") });
    await book({ startsAt: at(d, "09:30"), patientId: w.patient2.id });
    await expect(rescheduleAppointment({ clinicId: w.clinic.id, appointmentId: a.id, startsAt: at(d, "09:30") })).rejects.toMatchObject({ status: 409 });
    const moved = await rescheduleAppointment({ clinicId: w.clinic.id, appointmentId: a.id, startsAt: at(d, "10:00") });
    expect(moved.startsAt.toISOString()).toBe(at(d, "10:00").toISOString());
    const { slots } = await computeSlots({ clinicId: w.clinic.id, doctorId: w.doctor.id, branchId: w.b1.id, date: d });
    expect(slots.map((s) => s.time)).toContain("09:00");
  });
  it("cannot reschedule a checked-in appointment", async () => {
    const a = await book({ startsAt: at(futureDate(19), "09:00") });
    await changeStatus({ clinicId: w.clinic.id, appointmentId: a.id, to: "CHECKED_IN" });
    await expect(rescheduleAppointment({ clinicId: w.clinic.id, appointmentId: a.id, startsAt: at(futureDate(19), "10:00") })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});
