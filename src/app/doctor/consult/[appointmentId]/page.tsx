import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ConsultWorkspace } from "@/components/shell/consult-form";
import { pageRole } from "@/server/auth/page-guard";
import { doctorFor } from "@/server/clinical/service";

export const dynamic = "force-dynamic";
export default async function ConsultPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const ctx = await pageRole("DOCTOR"); const { appointmentId } = await params;
  const doctor = await doctorFor({ ...ctx, clinicId: ctx.clinicId! });
  const a = await db.appointment.findFirst({ where: { id: appointmentId, doctorId: doctor.id, clinicId: ctx.clinicId! }, include: { patient: true, consultation: true } });
  if (!a) notFound();
  const c = a.consultation;
  return (
    <div className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-semibold">Consultation: {a.patient.fullName}</h1><p className="text-sm text-muted-foreground">{a.patient.mrn} &middot; status {a.status}</p>
      <ConsultWorkspace appointmentId={a.id} canStart={["CHECKED_IN", "WAITING", "IN_PROGRESS"].includes(a.status)} consultation={c ? { id: c.id, complaint: c.complaint, clinicalNotes: c.clinicalNotes, diagnosis: c.diagnosis, treatmentPlan: c.treatmentPlan, completedAt: c.completedAt ? c.completedAt.toISOString() : null } : null} />
    </div>
  );
}
