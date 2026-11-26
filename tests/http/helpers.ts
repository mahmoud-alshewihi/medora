export const BASE = "http://localhost:3100";

/** Signs in through the real better-auth endpoint and returns the session Cookie header value. */
export async function signIn(email: string, password: string): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`sign-in failed for ${email}: ${r.status} ${await r.text()}`);
  const cookies = r.headers.getSetCookie();
  const session = cookies.find((c) => /session_token/.test(c));
  if (!session) throw new Error(`no session cookie for ${email}: ${cookies.join("; ")}`);
  return session.split(";")[0]!;
}

export const jsonHeaders = (cookie?: string, extra: Record<string, string> = {}) => ({
  "Content-Type": "application/json", Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...extra,
});

/** Reads the seeded fixture ids from the database (same ids the seeder printed). */
export async function fixtures() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const [alpha, beta] = await Promise.all([
    db.clinic.findUniqueOrThrow({ where: { slug: "alpha" }, include: { branches: true } }),
    db.clinic.findUniqueOrThrow({ where: { slug: "beta" }, include: { branches: true } }),
  ]);
  const itemA = await db.inventoryItem.findFirstOrThrow({ where: { clinicId: alpha.id } });
  const batchA2 = await db.inventoryBatch.findFirstOrThrow({ where: { itemId: itemA.id } });
  const supplierA = await db.supplier.findFirstOrThrow({ where: { clinicId: alpha.id } });
  const patientB = await db.patient.findFirstOrThrow({ where: { clinicId: beta.id } });
  const patientA = await db.patient.findFirstOrThrow({ where: { clinicId: alpha.id } });
  await db.$disconnect();
  return {
    clinicA: alpha.id, branchA1: alpha.branches.find((b) => b.name === "A1")!.id, branchA2: alpha.branches.find((b) => b.name === "A2")!.id,
    clinicB: beta.id, branchB1: beta.branches[0]!.id, itemA: itemA.id, batchA2: batchA2.id, supplierA: supplierA.id, patientA: patientA.id, patientB: patientB.id,
  };
}
