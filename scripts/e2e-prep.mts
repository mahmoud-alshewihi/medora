/* Reset e2e-mutated demo state so the suite is re-runnable: reopen today's cash registers. */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
const tomorrow = new Date(today.getTime() + 86400000);
const r = await db.cashRegister.updateMany({ where: { businessDate: { gte: today, lt: tomorrow }, closedAt: { not: null } }, data: { closedAt: null, countedCash: null, expectedCash: null } });
console.log("registers reopened:", r.count);
await db.$disconnect();
