import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const appts = await db.appointment.findMany({ where: { doctorId: { startsWith: "bdoc" } }, select: { id: true } });
const ids = appts.map((a) => a.id);
console.log("leftover bench appointments:", ids.length);
if (ids.length) {
  await db.prescription.deleteMany({ where: { consultation: { appointmentId: { in: ids } } } });
  await db.consultation.deleteMany({ where: { appointmentId: { in: ids } } });
  await db.appointmentStatusHistory.deleteMany({ where: { appointmentId: { in: ids } } });
  await db.appointment.deleteMany({ where: { id: { in: ids } } });
  console.log("deleted");
}
await db.$disconnect();
