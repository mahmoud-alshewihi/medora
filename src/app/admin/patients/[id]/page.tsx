import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageAccess } from "@/server/auth/page-guard";
import { PatientEditForm } from "@/components/shell/patient-ui";
import { can } from "@/server/auth/permissions";
import { getPatientProfile } from "@/server/patients/service";

export const dynamic = "force-dynamic";
type Appt = { id: string; startsAt: Date; status: string; doctor: string; branch: string };
type Billing = { outstanding: string; invoices: { id: string; number: string; status: string; total: string }[] } | null;
export default async function PatientProfile({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageAccess("patient.read"); const { id } = await params;
  const p = await getPatientProfile(ctx, id).catch(() => null);
  if (!p) notFound();
  const tz = await clinicTz(ctx.clinicId);
  const appts = p.appointments as Appt[]; const billing = p.billing as Billing;
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">{String(p.fullName)} <span className="text-sm text-muted-foreground">{String(p.mrn)}</span></h1>
      <Card className="grid gap-1 p-4 text-sm md:grid-cols-2"><p>Gender: {String(p.gender)}</p><p>Phone: {String(p.phone)}</p><p>Email: {String(p.email ?? "-")}</p><p>Date of birth: {p.dateOfBirth ? new Date(p.dateOfBirth as Date).toISOString().slice(0, 10) : "-"}</p></Card>
      {can(ctx.role, "patient.write") && <PatientEditForm p={{ id: String(p.id), fullName: String(p.fullName), gender: (p.gender as string | null) ?? null, dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth as Date).toISOString() : null, phone: (p.phone as string | null) ?? null, email: (p.email as string | null) ?? null, address: (p.address as string | null) ?? null }} />}
      <h2 className="font-medium">Appointments</h2>
      <DataTable head={["When", "Doctor", "Branch", "Status"]} rows={appts.map((a) => [fmtLocal(a.startsAt, tz), a.doctor, a.branch, <Badge key={a.id} value={a.status} />])} />
      {billing && <><h2 className="font-medium">Invoices (outstanding {billing.outstanding})</h2><DataTable head={["Number", "Total", "Status"]} rows={billing.invoices.map((i) => [i.number, i.total, <Badge key={i.id} value={i.status} />])} /></>}
      <p className="text-sm text-muted-foreground">{p.medicalAccess ? "Medical history is visible to you and each view is audited (full record via the API)." : "Medical history is not visible to your role."}</p>
    </div>
  );
}
