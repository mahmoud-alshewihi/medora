import { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { computeSlots } from "@/server/appointments/slots";
import { clientIp, open, rateLimit } from "@/server/http/handler";

const q = z.object({ clinicSlug: z.string().min(1), doctorId: z.string().min(1), branchId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const GET = open(async (req) => {
  const p = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const clinic = await db.clinic.findFirst({ where: { slug: p.clinicSlug, status: "ACTIVE" }, select: { id: true } });
  if (!clinic) throw notFound("Clinic");
  return computeSlots({ clinicId: clinic.id, doctorId: p.doctorId, branchId: p.branchId, date: p.date });
}, (req) => rateLimit("pub-slots:" + clientIp(req), 120, 60_000));
