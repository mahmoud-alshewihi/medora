/* Seeds the HTTP security-test database with fictional fixtures and credential users. */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../../src/server/auth/permissions";

const db = new PrismaClient();
export const PW = "HttpTest#2026";
const uid = () => randomUUID();

async function main() {
  for (const code of PERMISSIONS) await db.permission.create({ data: { code } });
  const perms = await db.permission.findMany();
  const roleIds = {} as Record<string, string>;
  for (const [key, list] of Object.entries(ROLE_PERMISSIONS)) {
    const r = await db.role.create({ data: { key: key as never, name: key } });
    roleIds[key] = r.id;
    await db.rolePermission.createMany({ data: perms.filter((p) => (list as string[]).includes(p.code)).map((p) => ({ roleId: r.id, permissionId: p.id })) });
  }
  const plan = await db.subscriptionPlan.create({ data: { code: "http-plan", name: "HTTP", priceMonthly: "0", maxBranches: 10, maxDoctors: 10, maxPatients: 100000 } });
  const hash = await hashPassword(PW);

  const mkClinic = async (slug: string) => {
    const clinic = await db.clinic.create({ data: { slug, name: `${slug} Clinic` } });
    await db.subscription.create({ data: { clinicId: clinic.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(), expiresAt: new Date(Date.now() + 300 * 86400000) } });
    return clinic;
  };
  const mkUser = async (email: string, role: string, clinicId: string | null, branchId: string | null = null) => {
    const id = uid();
    await db.user.create({ data: { id, name: email, email, emailVerified: true } });
    await db.account.create({ data: { id: uid(), accountId: id, providerId: "credential", userId: id, password: hash } });
    await db.membership.create({ data: { userId: id, roleId: roleIds[role]!, clinicId, branchId } });
    return id;
  };
  const hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), ["08:00", "20:00"]]));

  // Clinic A: owner + branch-pinned manager (branch A1), branch A2, inventory at A2
  const A = await mkClinic("alpha");
  const a1 = await db.branch.create({ data: { clinicId: A.id, name: "A1", workingHours: hours } });
  const a2 = await db.branch.create({ data: { clinicId: A.id, name: "A2", workingHours: hours } });
  await mkUser("owner@alpha.test", "CLINIC_OWNER", A.id);
  await mkUser("manager@alpha.test", "BRANCH_MANAGER", A.id, a1.id);
  const specA = await db.specialty.create({ data: { clinicId: A.id, name: "General" } });
  const docUserA = await mkUser("doctor@alpha.test", "DOCTOR", A.id);
  const doctorA = await db.doctor.create({ data: { clinicId: A.id, userId: docUserA, fullName: "Dr Alpha", specialtyId: specA.id, consultationFee: "100" } });
  const patientA = await db.patient.create({ data: { clinicId: A.id, mrn: "P-A1", fullName: "Patient Alpha" } });
  const catA = await db.inventoryCategory.create({ data: { clinicId: A.id, name: "Cons" } });
  const itemA = await db.inventoryItem.create({ data: { clinicId: A.id, categoryId: catA.id, sku: "GA", name: "Gloves A" } });
  const batchA2 = await db.inventoryBatch.create({ data: { itemId: itemA.id, branchId: a2.id, batchNumber: "B-A2", quantity: 100 } });
  const supA = await db.supplier.create({ data: { clinicId: A.id, name: "SupA" } });

  // Clinic B: owner + patient (for IDOR)
  const B = await mkClinic("beta");
  const b1 = await db.branch.create({ data: { clinicId: B.id, name: "B1", workingHours: hours } });
  await mkUser("owner@beta.test", "CLINIC_OWNER", B.id);
  const patientB = await db.patient.create({ data: { clinicId: B.id, mrn: "P-B1", fullName: "Patient Beta" } });

  console.log(JSON.stringify({ clinicA: A.id, branchA1: a1.id, branchA2: a2.id, itemA: itemA.id, batchA2: batchA2.id, supplierA: supA.id, clinicB: B.id, branchB1: b1.id, patientA: patientA.id, patientB: patientB.id, doctorA: doctorA.id }));
}

main().then(() => db.$disconnect());
