import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { saveUpload } from "@/server/files/storage";
import { secured } from "@/server/http/handler";
import { canAccessMedical } from "@/server/patients/service";

export const POST = secured("medical.write", {}, async ({ ctx, params, req }) => {
  if (!(await canAccessMedical(ctx, params.id!))) throw notFound("Patient");
  const form = await req.formData();
  const f = form.get("file");
  if (!(f instanceof File)) throw badRequest("file is required");
  const saved = await saveUpload(ctx.clinicId, { name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) });
  const row = await db.patientAttachment.create({ data: { patientId: params.id!, clinicId: ctx.clinicId, fileName: saved.safeName, storageKey: saved.storageKey, mimeType: f.type, sizeBytes: saved.sizeBytes, uploadedById: ctx.userId, patientVisible: form.get("patientVisible") === "true" } });
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "attachment.upload", entity: "PatientAttachment", entityId: row.id });
  return { id: row.id, fileName: row.fileName };
});
