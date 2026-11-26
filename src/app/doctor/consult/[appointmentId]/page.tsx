import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { ConsultWorkspace } from "@/components/shell/consult-form";
import { pageRole } from "@/server/auth/page-guard";
import { doctorFor } from "@/server/clinical/service";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
export default async function ConsultPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const ctx = await pageRole("DOCTOR"); const { appointmentId } = await params;
  const doctor = await doctorFor({ ...ctx, clinicId: ctx.clinicId! });
  const a = await db.appointment.findFirst({ where: { id: appointmentId, doctorId: doctor.id, clinicId: ctx.clinicId! }, include: { patient: true, consultation: { include: { prescriptions: true } } } });
  if (!a) notFound();
  const c = a.consultation;
  const initials = a.patient.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardContent className="flex items-center gap-4 pt-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary-soft text-lg font-bold text-primary">{initials}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">{a.patient.fullName}</h1>
            <p className="tnum text-sm text-muted-foreground">{a.patient.mrn}</p>
          </div>
          <Badge value={a.status} />
        </CardContent>
      </Card>
      <ConsultWorkspace appointmentId={a.id} canStart={["CHECKED_IN", "WAITING", "IN_PROGRESS"].includes(a.status)} consultation={c ? { id: c.id, complaint: c.complaint, clinicalNotes: c.clinicalNotes, diagnosis: c.diagnosis, treatmentPlan: c.treatmentPlan, completedAt: c.completedAt ? c.completedAt.toISOString() : null } : null} />
      {c && c.prescriptions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /><T>Issued prescriptions</T></CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">{c.prescriptions.map((r) => <li key={r.id} className="flex items-center justify-between py-2.5"><span className="tnum font-medium">{r.number}</span><Link className="text-sm font-medium text-primary hover:underline" href={`/print/prescription/${r.id}`}><T>View / print</T></Link></li>)}</ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
