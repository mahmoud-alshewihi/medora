import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BookingWizard } from "./wizard";

export const dynamic = "force-dynamic";
export default async function Book({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ doctor?: string }> }) {
  const { slug } = await params; const { doctor } = await searchParams;
  const c = await db.clinic.findFirst({ where: { slug, status: "ACTIVE" }, select: { name: true, branches: { where: { active: true }, select: { id: true, name: true } }, specialties: { select: { id: true, name: true } },
    doctors: { where: { active: true }, select: { id: true, fullName: true, specialtyId: true, schedules: { select: { branchId: true } } } } } });
  if (!c) notFound();
  return <main className="mx-auto max-w-2xl p-6"><h1 className="text-2xl font-semibold">Book at {c.name}</h1><BookingWizard slug={slug} branches={c.branches} specialties={c.specialties} doctors={c.doctors.map((d) => ({ id: d.id, fullName: d.fullName, specialtyId: d.specialtyId, branchIds: [...new Set(d.schedules.map((s) => s.branchId))] }))} presetDoctor={doctor} /></main>;
}
