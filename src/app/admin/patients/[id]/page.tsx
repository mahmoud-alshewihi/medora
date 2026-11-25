import { notFound } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { pageAccess } from "@/server/auth/page-guard";
import { getPatientProfile } from "@/server/patients/service";

export const dynamic = "force-dynamic";
export default async function PatientProfile({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageAccess("patient.read"); const { id } = await params;
  const p = await getPatientProfile(ctx, id).catch(() => null);
  if (!p) notFound();
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">{String(p.fullName)} <span className="text-sm text-muted-foreground">{String(p.mrn)}</span></h1>
      <Card className="p-4"><pre className="whitespace-pre-wrap text-xs">{JSON.stringify({ gender: p.gender, phone: p.phone, email: p.email, dateOfBirth: p.dateOfBirth, appointments: p.appointments, billing: p.billing }, null, 2)}</pre></Card>
      <p className="text-sm text-muted-foreground">Medical history is shown only to users with medical access and is audited.</p>
    </div>
  );
}
