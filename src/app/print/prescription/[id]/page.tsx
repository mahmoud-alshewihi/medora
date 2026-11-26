import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { PrintButton } from "@/components/shell/print-button";
import { getAccessContext } from "@/server/auth/access";
import { can } from "@/server/auth/permissions";
import { canAccessMedical } from "@/server/patients/service";
import { prescriptionPrintData } from "@/server/clinical/service";

export const dynamic = "force-dynamic";
export default async function PrintPrescription({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAccessContext(); const { id } = await params;
  if (!ctx || !ctx.clinicId) redirect("/login");
  const data = await prescriptionPrintData(id, ctx.clinicId);
  if (!data) notFound();
  const { rx, clinic } = data;
  let allowed = false;
  if (ctx.role === "PATIENT") { const p = await db.patient.findFirst({ where: { id: rx.patientId, userId: ctx.userId } }); allowed = !!p; }
  else if (can(ctx.role, "medical.read")) allowed = await canAccessMedical({ ...ctx, clinicId: ctx.clinicId }, rx.patientId);
  if (!allowed) notFound();
  const tz = await clinicTz(ctx.clinicId);
  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl space-y-6 rounded-xl bg-white p-10 text-black shadow-md print:rounded-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 pb-4" style={{ borderColor: "hsl(178 60% 25%)" }}>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "hsl(178 60% 25%)" }}>{clinic.name}</h1>
            <p className="mt-0.5 text-sm text-gray-600">{clinic.address} {clinic.phone && <>&middot; {clinic.phone}</>}</p>
          </div>
          <div className="text-end print:hidden"><PrintButton /></div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <p><span className="text-gray-500">Patient:</span> <b>{rx.patient.fullName}</b> <span className="text-gray-500">({rx.patient.mrn})</span></p>
          <p><span className="text-gray-500">Date:</span> {fmtLocal(rx.issuedAt, tz).slice(0, 10)}</p>
          <p><span className="text-gray-500">Doctor:</span> {rx.doctor.fullName}</p>
          <p><span className="text-gray-500">Prescription no.:</span> <span className="font-mono">{rx.number}</span></p>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-4xl font-bold leading-none" style={{ color: "hsl(178 60% 25%)" }}>&#8478;</span>
          <table className="w-full text-sm">
            <thead><tr className="border-b-2 border-gray-300 text-start"><th className="py-2 text-start font-semibold">Medication</th><th className="text-start font-semibold">Dosage</th><th className="text-start font-semibold">Frequency</th><th className="text-start font-semibold">Duration</th></tr></thead>
            <tbody>{rx.items.map((i) => <tr key={i.id} className="border-b border-gray-200"><td className="py-2.5 font-medium">{i.medication}{i.instructions && <span className="block text-xs font-normal text-gray-500">{i.instructions}</span>}</td><td>{i.dosage}</td><td>{i.frequency}</td><td>{i.duration}</td></tr>)}</tbody>
          </table>
        </div>
        {rx.notes && <p className="rounded-md bg-gray-50 p-3 text-sm"><b>Notes:</b> {rx.notes}</p>}
        <div className="flex items-end justify-between pt-12 text-xs text-gray-500">
          <p>Demo data, not for real medical use.</p>
          <div className="text-center"><p className="mb-1 border-b border-gray-400 px-8">&nbsp;</p><p>Signature &middot; {rx.doctor.fullName}</p></div>
        </div>
      </div>
    </div>
  );
}
