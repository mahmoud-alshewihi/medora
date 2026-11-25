import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { assertClinicUsable } from "@/server/auth/access";
import { clientIp, open, rateLimit } from "@/server/http/handler";
import { registerPatient } from "@/server/patients/service";

const body = z.object({ clinicSlug: z.string(), fullName: z.string().trim().min(2).max(120), email: z.string().email(), password: z.string().min(8).max(100), phone: z.string().trim().min(6).max(30) });

/** Patient self-registration: creates the login, a PATIENT membership and the linked patient record in one transaction. */
export const POST = open(async (req) => {
  const b = body.parse(await req.json());
  const clinic = await db.clinic.findFirst({ where: { slug: b.clinicSlug, status: "ACTIVE" }, select: { id: true } });
  if (!clinic) throw notFound("Clinic");
  await assertClinicUsable(clinic.id, { write: true });
  const email = b.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) throw conflict("EMAIL_TAKEN", "An account with this email already exists");
  const role = await db.role.findUniqueOrThrow({ where: { key: "PATIENT" } });
  const id = randomUUID(); const hash = await hashPassword(b.password);
  await db.$transaction(async (tx) => {
    await tx.user.create({ data: { id, name: b.fullName, email, emailVerified: false } });
    await tx.account.create({ data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash } });
    await tx.membership.create({ data: { userId: id, roleId: role.id, clinicId: clinic.id } });
  });
  await registerPatient(clinic.id, { fullName: b.fullName, phone: b.phone, email }, id, id);
  return { ok: true };
}, (req) => rateLimit("portal-reg:" + clientIp(req), 5, 60_000));
