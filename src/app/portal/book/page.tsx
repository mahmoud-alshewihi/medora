import { PageTitle } from "@/components/shell/page-title";
import { db } from "@/lib/db";
import { PortalBook } from "@/components/shell/portal-book";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { pageRole } from "@/server/auth/page-guard";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
export default async function PortalBookPage() {
  const ctx = await pageRole("PATIENT");
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId! }, select: { slug: true } });
  const [branches, doctors] = await Promise.all([db.branch.findMany({ where: { clinicId: ctx.clinicId! }, select: { id: true, name: true } }), db.doctor.findMany({ where: { clinicId: ctx.clinicId! }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } })]);
  return (
    <div className="space-y-4">
      <PageTitle>Book an appointment</PageTitle>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle><T>Choose your visit</T></CardTitle></CardHeader>
        <CardContent><PortalBook slug={clinic.slug} branches={branches} doctors={doctors} /></CardContent>
      </Card>
    </div>
  );
}
