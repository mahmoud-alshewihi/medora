import { PageTitle } from "@/components/shell/page-title";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageAccess } from "@/server/auth/page-guard";
import { queueForBranch } from "@/server/appointments/service";

export const dynamic = "force-dynamic";
export default async function Reception() {
  const ctx = await pageAccess("queue.manage");
  const q = await queueForBranch(ctx.clinicId, ctx.branchId ?? null);
  return (
    <div className="space-y-4"><AutoRefresh seconds={15} /><PageTitle>Live queue</PageTitle><p className="text-xs text-muted-foreground">Refreshes every 15s (polling, not websockets).</p>
      <DataTable empty="Nobody is waiting" head={["#", "Patient", "Doctor", "Status", "Est. wait (min)"]} rows={q.map((w) => [w.queueNumber ?? "-", w.patient.fullName, w.doctor.fullName, <Badge key={w.id} value={w.status} />, w.estimatedWaitMin])} />
    </div>
  );
}
