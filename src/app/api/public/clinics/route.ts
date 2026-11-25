import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { clientIp, open, rateLimit } from "@/server/http/handler";

export const GET = open(async (req) => {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return db.clinic.findMany({ where: { status: "ACTIVE" }, select: { slug: true, name: true, nameAr: true, description: true } });
  const c = await db.clinic.findFirst({ where: { slug, status: "ACTIVE" }, select: { id: true, slug: true, name: true, nameAr: true, description: true, phone: true, email: true, address: true, currency: true, timezone: true,
    branches: { where: { active: true }, select: { id: true, name: true, city: true, address: true, phone: true, workingHours: true } },
    specialties: { select: { id: true, name: true, nameAr: true, description: true } },
    services: { where: { active: true }, select: { id: true, name: true, price: true, durationMin: true, specialtyId: true } },
    doctors: { where: { active: true }, select: { id: true, fullName: true, specialtyId: true, bio: true, qualifications: true, yearsExperience: true, consultationFee: true, schedules: { select: { branchId: true, weekday: true, startTime: true, endTime: true } } } },
    testimonials: { select: { author: true, quote: true, isDemo: true } }, faqs: { orderBy: { position: "asc" }, select: { question: true, answer: true } } } });
  if (!c) throw notFound("Clinic");
  return c;
}, (req) => rateLimit("pub-clinics:" + clientIp(req), 120, 60_000));
