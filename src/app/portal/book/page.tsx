import { db } from "@/lib/db";
import { PortalBook } from "@/components/shell/portal-book";
import { pageRole } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";
export default async function PortalBookPage() {
  const ctx = await pageRole("PATIENT");
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId! }, select: { slug: true } });
  const [branches, doctors] = await Promise.all([db.branch.findMany({ where: { clinicId: ctx.clinicId! }, select: { id: true, name: true } }), db.doctor.findMany({ where: { clinicId: ctx.clinicId! }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } })]);
  return <div className="space-y-4"><h1 className="text-2xl font-semibold">Book an appointment</h1><PortalBook slug={clinic.slug} branches={branches} doctors={doctors} /></div>;
}
