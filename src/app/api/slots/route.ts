import { z } from "zod";
import { computeSlots } from "@/server/appointments/slots";
import { secured } from "@/server/http/handler";

const q = z.object({ doctorId: z.string(), branchId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), durationMin: z.coerce.number().int().min(5).max(240).optional(), excludeAppointmentId: z.string().optional() });
export const GET = secured("appointment.read", {}, async ({ ctx, url }) => computeSlots({ clinicId: ctx.clinicId, ...q.parse(Object.fromEntries(url.searchParams)) }));
