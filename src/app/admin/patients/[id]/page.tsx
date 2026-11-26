import { notFound } from "next/navigation";
import { AlertTriangle, CalendarDays, FileText, Mail, Phone, Pill, StickyNote, Stethoscope } from "lucide-react";
import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageAccess } from "@/server/auth/page-guard";
import { PatientEditForm } from "@/components/shell/patient-ui";
import { can } from "@/server/auth/permissions";
import { getPatientProfile } from "@/server/patients/service";
import { getLocale } from "@/lib/i18n/server";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
type Appt = { id: string; startsAt: Date; status: string; doctor: string; branch: string };
type Billing = { outstanding: string; invoices: { id: string; number: string; status: string; total: string; issuedAt: Date }[] } | null;
type RecordRow = { id: string; kind: string; title: string; body: string; icd10: string | null; createdAt: Date };
type Consult = { id: string; doctor: { fullName: string }; complaint: string | null; diagnosis: string | null; treatmentPlan: string | null; vitals: unknown; completedAt: Date | null; createdAt: Date };
type Rx = { id: string; number: string; issuedAt: Date; items: { id: string; medication: string; dosage: string; frequency: string; duration: string }[] };
type Att = { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: Date };
type Note = { id: string; body: string; createdAt: Date };

export default async function PatientProfile({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageAccess("patient.read"); const { id } = await params;
  const p = await getPatientProfile(ctx, id).catch(() => null);
  if (!p) notFound();
  const tz = await clinicTz(ctx.clinicId);
  const loc = await getLocale();
  const dateFmt = new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const appts = p.appointments as Appt[]; const billing = p.billing as Billing;
  const medical = p.medicalAccess as boolean;
  const records = (p.records ?? []) as RecordRow[];
  const consults = (p.consultations ?? []) as Consult[];
  const rxs = (p.prescriptions ?? []) as Rx[];
  const atts = (p.attachments ?? []) as Att[];
  const notes = (p.notes ?? []) as Note[];
  const initials = String(p.fullName).split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const age = p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth as Date).getTime()) / 31557600000) : null;

  return (
    <div className="space-y-5">
      {/* identity header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-lg font-bold text-primary">{initials}</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{String(p.fullName)}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                <span className="tnum font-medium text-foreground/80">{String(p.mrn)}</span>
                {p.gender ? <Badge value={String(p.gender)} /> : null}
                {age !== null ? <span>{age} <T>years</T></span> : null}
                {p.archivedAt ? <Badge value="ARCHIVED" /> : null}
              </p>
            </div>
          </div>
          <div className="grid gap-1 text-[13px]">
            {p.phone ? <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span dir="ltr" className="tnum">{String(p.phone)}</span></p> : null}
            {p.email ? <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{String(p.email)}</p> : null}
            {(p.emergencyContact as { name?: string; phone?: string })?.name ? (
              <p className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /><T>Emergency</T>: {String((p.emergencyContact as { name: string }).name)} <span dir="ltr" className="tnum">{String((p.emergencyContact as { phone?: string }).phone ?? "")}</span></p>
            ) : null}
          </div>
        </div>
      </Card>

      {billing ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card/60 px-3.5 py-2.5"><p className="text-[11px] font-medium text-muted-foreground"><T>Outstanding</T></p><p className="tnum mt-0.5 text-sm font-semibold">{billing.outstanding}</p></div>
          <div className="rounded-lg border bg-card/60 px-3.5 py-2.5"><p className="text-[11px] font-medium text-muted-foreground"><T>Appointments</T></p><p className="tnum mt-0.5 text-sm font-semibold">{appts.length}</p></div>
          <div className="rounded-lg border bg-card/60 px-3.5 py-2.5"><p className="text-[11px] font-medium text-muted-foreground"><T>Invoices</T></p><p className="tnum mt-0.5 text-sm font-semibold">{billing.invoices.length}</p></div>
        </div>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><T>Overview</T></TabsTrigger>
          {medical ? <TabsTrigger value="medical"><T>Medical</T></TabsTrigger> : null}
          {medical ? <TabsTrigger value="prescriptions"><T>Prescriptions</T></TabsTrigger> : null}
          {medical ? <TabsTrigger value="files"><T>Files & notes</T></TabsTrigger> : null}
          {can(ctx.role, "patient.write") ? <TabsTrigger value="edit"><T>Edit details</T></TabsTrigger> : null}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><T>Appointment timeline</T></CardTitle></CardHeader>
            <CardContent>
              <DataTable head={["When", "Doctor", "Branch", "Status"]} rows={appts.map((a) => [
                <span key="w" className="tnum">{fmtLocal(a.startsAt, tz)}</span>, a.doctor, a.branch, <Badge key={a.id} value={a.status} />,
              ])} empty="No appointments yet" />
            </CardContent>
          </Card>
          {billing ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><T>Billing history</T></CardTitle></CardHeader>
              <CardContent>
                <DataTable head={["Number", "Issued", "Total", "Status"]} rows={billing.invoices.map((i) => [
                  <span key="n" className="tnum font-medium">{i.number}</span>,
                  <span key="d" className="tnum text-muted-foreground">{dateFmt.format(new Date(i.issuedAt))}</span>,
                  <span key="t" className="tnum">{i.total}</span>, <Badge key={i.id} value={i.status} />,
                ])} empty="No invoices" />
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {medical ? (
          <TabsContent value="medical" className="mt-4 space-y-4">
            {(p.allergies || p.chronicConditions) ? (
              <Card className="border-warn/30 bg-warn-soft/30 p-4 text-sm">
                {p.allergies ? <p><b><T>Allergies</T>:</b> {String(p.allergies)}</p> : null}
                {p.chronicConditions ? <p className="mt-1"><b><T>Chronic conditions</T>:</b> {String(p.chronicConditions)}</p> : null}
              </Card>
            ) : null}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /><T>Consultations</T></CardTitle></CardHeader>
              <CardContent>
                {consults.length ? (
                  <ul className="space-y-3">
                    {consults.map((c) => (
                      <li key={c.id} className="rounded-lg border p-3.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b>{c.doctor.fullName}</b>
                          <span className="text-xs text-muted-foreground">{dateFmt.format(new Date(c.createdAt))}{c.completedAt ? ` · ${(c.completedAt as unknown as Date).toLocaleDateString?.() ?? ""}` : ""}</span>
                        </div>
                        {c.complaint ? <p className="mt-1.5"><span className="text-muted-foreground"><T>Complaint</T>:</span> {c.complaint}</p> : null}
                        {c.diagnosis ? <p className="mt-1"><span className="text-muted-foreground"><T>Diagnosis</T>:</span> {c.diagnosis}</p> : null}
                        {c.treatmentPlan ? <p className="mt-1"><span className="text-muted-foreground"><T>Treatment plan</T>:</span> {c.treatmentPlan}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="No consultations yet" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle><T>Medical history</T></CardTitle></CardHeader>
              <CardContent>
                {records.length ? (
                  <ul className="space-y-3">
                    {records.map((r) => (
                      <li key={r.id} className="rounded-lg border p-3.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b>{r.title}</b>
                          <span className="flex items-center gap-2"><Badge value={r.kind} /><span className="text-xs text-muted-foreground">{dateFmt.format(new Date(r.createdAt))}</span></span>
                        </div>
                        <p className="mt-1.5 text-muted-foreground">{r.body}</p>
                        {r.icd10 ? <p className="mt-1 text-xs text-muted-foreground">ICD-10: {r.icd10}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="No medical records yet" />}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {medical ? (
          <TabsContent value="prescriptions" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4 text-primary" /><T>Prescriptions</T></CardTitle></CardHeader>
              <CardContent>
                {rxs.length ? (
                  <ul className="space-y-3">
                    {rxs.map((rx) => (
                      <li key={rx.id} className="rounded-lg border p-3.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b className="tnum">{rx.number}</b>
                          <span className="text-xs text-muted-foreground">{dateFmt.format(new Date(rx.issuedAt))}</span>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {rx.items.map((it) => <li key={it.id} className="text-[13px]"><b>{it.medication}</b> <span className="text-muted-foreground">{it.dosage} · {it.frequency} · {it.duration}</span></li>)}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="No prescriptions yet" />}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {medical ? (
          <TabsContent value="files" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle><T>Attachments</T></CardTitle></CardHeader>
              <CardContent>
                {atts.length ? (
                  <ul className="space-y-2">
                    {atts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                        <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{a.fileName}</span></span>
                        <span className="shrink-0 text-xs text-muted-foreground">{(a.sizeBytes / 1024).toFixed(0)} KB</span>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="No attachments" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-primary" /><T>Patient notes</T></CardTitle></CardHeader>
              <CardContent>
                {notes.length ? (
                  <ul className="space-y-2">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-lg border p-2.5 text-sm"><p>{n.body}</p><p className="mt-1 text-xs text-muted-foreground">{dateFmt.format(new Date(n.createdAt))}</p></li>
                    ))}
                  </ul>
                ) : <EmptyState title="No notes" />}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {can(ctx.role, "patient.write") ? (
          <TabsContent value="edit" className="mt-4">
            <Card className="p-5">
              <PatientEditForm p={{ id: String(p.id), fullName: String(p.fullName), gender: (p.gender as string | null) ?? null, dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth as Date).toISOString() : null, phone: (p.phone as string | null) ?? null, email: (p.email as string | null) ?? null, address: (p.address as string | null) ?? null }} />
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      {!medical ? <p className="text-[13px] text-muted-foreground"><T>Medical history is not visible to your role.</T></p> : null}
    </div>
  );
}
