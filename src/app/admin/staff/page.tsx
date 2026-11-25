import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { StaffForm, StaffStatusButton } from "@/components/shell/staff-ui";
import { pageAccess } from "@/server/auth/page-guard";
import { listStaff } from "@/server/staff/service";

export const dynamic = "force-dynamic";
export default async function StaffPage() {
  const ctx = await pageAccess("staff.manage");
  const [staff, branches] = await Promise.all([listStaff(ctx.clinicId, ctx.branchId), db.branch.findMany({ where: { clinicId: ctx.clinicId } })]);
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Staff</h1>
      <StaffForm branches={branches} />
      <DataTable head={["Name", "Email", "Role", "Branch", "Status", ""]} rows={staff.map((s) => [s.name, s.email, s.role, s.branch, <Badge key={s.userId} value={s.status} />, s.userId === ctx.userId ? "" : <StaffStatusButton key={s.userId + "b"} userId={s.userId} status={s.status} />])} />
    </div>
  );
}
