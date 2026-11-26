import { T } from "@/components/t";
import { PageTitle } from "@/components/shell/page-title";
import { Stethoscope, UserCheck, UserX, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { StaffForm, StaffStatusButton, DoctorForm } from "@/components/shell/staff-ui";
import { pageAccess } from "@/server/auth/page-guard";
import { listStaff } from "@/server/staff/service";

export const dynamic = "force-dynamic";
const AVATAR_TONES = ["bg-primary-soft text-primary", "bg-info-soft text-info", "bg-warn-soft text-warn", "bg-success-soft text-success", "bg-danger-soft text-danger"];

export default async function StaffPage() {
  const ctx = await pageAccess("staff.manage");
  const [staff, branches, specialties] = await Promise.all([listStaff(ctx.clinicId, ctx.branchId), db.branch.findMany({ where: { clinicId: ctx.clinicId } }), db.specialty.findMany({ where: { clinicId: ctx.clinicId }, orderBy: { name: "asc" } })]);
  const active = staff.filter((s) => s.status === "ACTIVE").length;
  const doctors = staff.filter((s) => s.role === "DOCTOR").length;
  return (
    <div className="space-y-4">
      <PageTitle>Staff</PageTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Users className="h-3.5 w-3.5" /><T>Total staff</T></p><p className="tnum mt-1 text-xl font-bold">{staff.length}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><UserCheck className="h-3.5 w-3.5" /><T>Active</T></p><p className="tnum mt-1 text-xl font-bold">{active}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><UserX className="h-3.5 w-3.5" /><T>Suspended</T></p><p className="tnum mt-1 text-xl font-bold">{staff.length - active}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Stethoscope className="h-3.5 w-3.5" /><T>Doctors</T></p><p className="tnum mt-1 text-xl font-bold">{doctors}</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle><T>Add staff</T></CardTitle></CardHeader><CardContent><StaffForm branches={branches} /></CardContent></Card>
        <Card><CardContent className="pt-5"><DoctorForm branches={branches} specialties={specialties} /></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle><T>Team directory</T></CardTitle></CardHeader>
        <CardContent>
          <DataTable
            head={["Name", "Email", "Role", "Branch", "Status", ""]}
            empty="No staff yet"
            rows={staff.map((s) => {
              const initials = s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              const tone = AVATAR_TONES[[...s.name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
              return [
                <span key="n" className="flex items-center gap-2.5 font-medium"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${tone}`}>{initials}</span>{s.name}</span>,
                <span key="e" className="text-muted-foreground">{s.email}</span>,
                <T key={s.userId + "r"}>{s.role}</T>,
                s.branch,
                <Badge key={s.userId} value={s.status} />,
                s.userId === ctx.userId ? "" : <StaffStatusButton key={s.userId + "b"} userId={s.userId} status={s.status} />,
              ];
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
