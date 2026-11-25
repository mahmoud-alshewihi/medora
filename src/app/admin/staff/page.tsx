import { PageTitle } from "@/components/shell/page-title";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { StaffForm, StaffStatusButton, DoctorForm } from "@/components/shell/staff-ui";
import { pageAccess } from "@/server/auth/page-guard";
import { listStaff } from "@/server/staff/service";

export const dynamic = "force-dynamic";
export default async function StaffPage() {
  const ctx = await pageAccess("staff.manage");
  const [staff, branches, specialties] = await Promise.all([listStaff(ctx.clinicId, ctx.branchId), db.branch.findMany({ where: { clinicId: ctx.clinicId } }), db.specialty.findMany({ where: { clinicId: ctx.clinicId }, orderBy: { name: "asc" } })]);
  return (
    <div className="space-y-4"><PageTitle>Staff</PageTitle>
      <StaffForm branches={branches} />
      <DoctorForm branches={branches} specialties={specialties} />
      <DataTable head={["Name", "Email", "Role", "Branch", "Status", ""]} rows={staff.map((s) => [s.name, s.email, s.role, s.branch, <Badge key={s.userId} value={s.status} />, s.userId === ctx.userId ? "" : <StaffStatusButton key={s.userId + "b"} userId={s.userId} status={s.status} />])} />
    </div>
  );
}
