import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/server/audit/audit";
import { assertBranchAllowed } from "@/server/auth/access";
import { enforcePlanLimit } from "@/server/platform/service";
import { secured } from "@/server/http/handler";

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("specialty"), name: z.string().min(2).max(80), nameAr: z.string().max(80).optional() }),
  z.object({ kind: z.literal("service"), name: z.string().min(2).max(120), price: z.union([z.string(), z.number()]), durationMin: z.number().int().min(5).max(240), specialtyId: z.string().nullable().optional() }),
  z.object({ kind: z.literal("branch"), name: z.string().min(2).max(80), city: z.string().max(80).optional(), address: z.string().max(200).optional(), phone: z.string().max(30).optional(), workingHours: z.record(z.string(), z.tuple([z.string(), z.string()])) }),
  z.object({ kind: z.literal("holiday"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name: z.string().min(2).max(100), branchId: z.string().nullable().optional() }),
  z.object({ kind: z.literal("vacation"), doctorId: z.string(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().max(200).optional() }),
]);
export const GET = secured("clinic.settings", {}, async ({ ctx }) => ({
  specialties: await db.specialty.findMany({ where: { clinicId: ctx.clinicId } }), services: await db.service.findMany({ where: { clinicId: ctx.clinicId } }),
  branches: await db.branch.findMany({ where: { clinicId: ctx.clinicId } }), holidays: await db.holiday.findMany({ where: { clinicId: ctx.clinicId }, orderBy: { date: "asc" } }),
}));
export const POST = secured("clinic.settings", { body }, async ({ ctx, body }) => {
  const c = ctx.clinicId; let row: { id: string };
  switch (body.kind) {
    case "specialty": row = await db.specialty.create({ data: { clinicId: c, name: body.name, nameAr: body.nameAr } }); break;
    case "service": row = await db.service.create({ data: { clinicId: c, name: body.name, price: String(body.price), durationMin: body.durationMin, specialtyId: body.specialtyId ?? null } }); break;
    case "branch": await enforcePlanLimit(c, "branches"); row = await db.branch.create({ data: { clinicId: c, name: body.name, city: body.city, address: body.address, phone: body.phone, workingHours: body.workingHours } }); break;
    case "holiday": assertBranchAllowed(ctx, body.branchId); row = await db.holiday.create({ data: { clinicId: c, date: new Date(body.date + "T00:00:00Z"), name: body.name, branchId: body.branchId ?? null } }); break;
    case "vacation": {
      const d = await db.doctor.findFirst({ where: { id: body.doctorId, clinicId: c } });
      if (!d) throw (await import("@/lib/errors")).notFound("Doctor");
      row = await db.doctorVacation.create({ data: { doctorId: d.id, startDate: new Date(body.startDate + "T00:00:00Z"), endDate: new Date(body.endDate + "T00:00:00Z"), reason: body.reason } }); break;
    }
  }
  await audit({ clinicId: c, userId: ctx.userId, action: `settings.${body.kind}.create`, entity: body.kind, entityId: row.id });
  return row;
});
