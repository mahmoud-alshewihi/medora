import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { getAccessContext } from "@/server/auth/access";
import { readUpload } from "@/server/files/storage";
import { canAccessMedical } from "@/server/patients/service";
import { open } from "@/server/http/handler";
import { unauthorized } from "@/lib/errors";

/** Private medical files: streamed only after an authorization check; never served from a public path. */
export const GET = open(async (_req, params) => {
  const ctx = await getAccessContext();
  if (!ctx || !ctx.clinicId) throw unauthorized();
  const att = await db.patientAttachment.findFirst({ where: { id: params.id!, clinicId: ctx.clinicId } });
  if (!att) throw notFound("Attachment");
  let allowed = false;
  if (ctx.role === "PATIENT") allowed = att.patientVisible && !!(await db.patient.findFirst({ where: { id: att.patientId, userId: ctx.userId } }));
  else allowed = await canAccessMedical({ ...ctx, clinicId: ctx.clinicId }, att.patientId);
  if (!allowed) throw notFound("Attachment");
  const data = await readUpload(att.storageKey);
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "attachment.read", entity: "PatientAttachment", entityId: att.id });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": att.mimeType, "Content-Disposition": `inline; filename="${att.fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});
