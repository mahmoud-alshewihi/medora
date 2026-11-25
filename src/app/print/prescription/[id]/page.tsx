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
    <div className="mx-auto my-6 max-w-2xl space-y-5 bg-white p-8 text-black shadow print:my-0 print:shadow-none">
      <div className="flex items-start justify-between border-b-2 border-teal-700 pb-3"><div><h1 className="text-2xl font-bold text-teal-800">{clinic.name}</h1><p className="text-sm">{clinic.address} {clinic.phone && <>&middot; {clinic.phone}</>}</p></div><PrintButton /></div>
      <div className="grid grid-cols-2 gap-1 text-sm"><p><b>Patient:</b> {rx.patient.fullName} ({rx.patient.mrn})</p><p><b>Date:</b> {fmtLocal(rx.issuedAt, tz).slice(0, 10)}</p><p><b>Doctor:</b> {rx.doctor.fullName}</p><p><b>Prescription no.:</b> {rx.number}</p></div>
      <table className="w-full text-sm"><thead><tr className="border-b text-start"><th className="py-1 text-start">Medication</th><th className="text-start">Dosage</th><th className="text-start">Frequency</th><th className="text-start">Duration</th></tr></thead>
        <tbody>{rx.items.map((i) => <tr key={i.id} className="border-b"><td className="py-1.5">{i.medication}{i.instructions && <span className="block text-xs text-gray-600">{i.instructions}</span>}</td><td>{i.dosage}</td><td>{i.frequency}</td><td>{i.duration}</td></tr>)}</tbody></table>
      {rx.notes && <p className="text-sm"><b>Notes:</b> {rx.notes}</p>}
      <p className="pt-10 text-xs text-gray-500">Signature: ______________________ &nbsp; Issued by {rx.doctor.fullName}. Demo data, not for real medical use.</p>
    </div>
  );
}
