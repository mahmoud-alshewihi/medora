import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const clinic = await db.clinic.findUniqueOrThrow({ where: { slug: "nile-care" } });
const docs = await db.doctor.findMany({ where: { clinicId: clinic.id, id: { startsWith: "bdoc" } } });
const branch = await db.branch.findFirstOrThrow({ where: { clinicId: clinic.id } });
for (const d of docs) for (let wd = 0; wd <= 6; wd++) {
  await db.doctorSchedule.upsert({ where: { id: `bsch_${d.id}_${wd}` }, update: {}, create: { id: `bsch_${d.id}_${wd}`, doctorId: d.id, branchId: branch.id, weekday: wd, startTime: "09:00", endTime: "17:00", breakStart: "13:00", breakEnd: "13:30" } });
}
console.log("schedules for", docs.length, "doctors at", branch.name);
await db.$disconnect();
