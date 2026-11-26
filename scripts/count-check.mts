import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const clinic = await db.clinic.findFirst({ where: { slug: "nile-care" }, select: { id: true } });
const cid = clinic!.id;
console.log("patients", await db.patient.count({ where: { clinicId: cid } }));
console.log("appointments", await db.appointment.count({ where: { clinicId: cid } }));
console.log("clinics", await db.clinic.count());
console.log("bench left", await db.patient.count({ where: { id: { startsWith: "bpat" } } }));
await db.$disconnect();
