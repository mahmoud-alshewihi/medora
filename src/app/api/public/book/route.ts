import { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { bookAppointment, parseStartsAt } from "@/server/appointments/service";
import { assertClinicUsable } from "@/server/auth/access";
import { clientIp, open, rateLimit } from "@/server/http/handler";
import { registerPatient } from "@/server/patients/service";

const body = z.object({
  clinicSlug: z.string().min(1), branchId: z.string().min(1), doctorId: z.string().min(1), startsAt: z.string().min(10),
  reason: z.string().max(500).optional(),
  patient: z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(6).max(30), email: z.string().email().optional().or(z.literal("")) }),
});

export const POST = open(async (req) => {
  const b = body.parse(await req.json());
  const clinic = await db.clinic.findFirst({ where: { slug: b.clinicSlug, status: "ACTIVE" }, select: { id: true } });
  if (!clinic) throw notFound("Clinic");
  await assertClinicUsable(clinic.id, { write: true });
  const existing = await db.patient.findFirst({ where: { clinicId: clinic.id, phone: b.patient.phone, fullName: { equals: b.patient.fullName, mode: "insensitive" }, archivedAt: null } });
  const patient = existing ?? (await registerPatient(clinic.id, { fullName: b.patient.fullName, phone: b.patient.phone, email: b.patient.email || null }));
  const a = await bookAppointment({ clinicId: clinic.id, branchId: b.branchId, doctorId: b.doctorId, patientId: patient.id, startsAt: parseStartsAt(b.startsAt), reason: b.reason, source: "ONLINE" });
  return { reference: a.reference, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status };
}, (req) => rateLimit("pub-book:" + clientIp(req), 10, 60_000));
