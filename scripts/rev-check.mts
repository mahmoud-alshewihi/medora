import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const clinic = await db.clinic.findFirst({ where: { slug: "nile-care" } });
const rows = await db.$queryRaw<{ m: string; total: string }[]>`SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') as m, sum(amount)::text as total FROM "Payment" WHERE "clinicId" = ${clinic!.id} GROUP BY 1 ORDER BY 1`;
console.log(rows);
const exp = await db.$queryRaw<{ m: string; total: string }[]>`SELECT to_char(date_trunc('month', "incurredOn"), 'YYYY-MM') as m, sum(amount)::text as total FROM "Expense" WHERE "clinicId" = ${clinic!.id} GROUP BY 1 ORDER BY 1`;
console.log(exp);
await db.$disconnect();
