import { PageTitle } from "@/components/shell/page-title";
import { db } from "@/lib/db";
import { SettingsForm } from "@/components/shell/settings-form";
import { pageAccess } from "@/server/auth/page-guard";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Building2, CreditCard, Stethoscope, Users } from "lucide-react";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const ctx = await pageAccess("clinic.settings");
  const [c, branches, users, doctors, invoices] = await Promise.all([
    db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } }),
    db.branch.count({ where: { clinicId: ctx.clinicId } }),
    db.membership.count({ where: { clinicId: ctx.clinicId, role: { key: { not: "PATIENT" } } } }),
    db.doctor.count({ where: { clinicId: ctx.clinicId } }),
    db.invoice.count({ where: { clinicId: ctx.clinicId } }),
  ]);
  return (
    <div className="space-y-4">
      <PageTitle>Clinic settings</PageTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Building2 className="h-3.5 w-3.5" /><T>Branches</T></p><p className="tnum mt-1 text-xl font-bold">{branches}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Users className="h-3.5 w-3.5" /><T>Staff accounts</T></p><p className="tnum mt-1 text-xl font-bold">{users}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Stethoscope className="h-3.5 w-3.5" /><T>Doctors</T></p><p className="tnum mt-1 text-xl font-bold">{doctors}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CreditCard className="h-3.5 w-3.5" /><T>Invoices issued</T></p><p className="tnum mt-1 text-xl font-bold">{invoices}</p></div>
      </div>
      <Card className="max-w-2xl">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle><T>Clinic profile</T></CardTitle>
          <Badge value={c.status} />
        </CardHeader>
        <CardContent><SettingsForm c={c} /></CardContent>
      </Card>
    </div>
  );
}
