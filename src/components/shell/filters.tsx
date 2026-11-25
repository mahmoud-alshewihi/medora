import { Button, Input, Select } from "@/components/ui/primitives";

export function ReportFilters({ action, from, to, branchId, doctorId, branches, doctors, lockBranch }: { action: string; from: string; to: string; branchId?: string; doctorId?: string; branches: { id: string; name: string }[]; doctors: { id: string; fullName: string }[]; lockBranch?: boolean }) {
  return (
    <form action={action} className="no-print flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <label className="text-xs">From<Input type="date" name="from" defaultValue={from} className="mt-1 w-40" /></label>
      <label className="text-xs">To<Input type="date" name="to" defaultValue={to} className="mt-1 w-40" /></label>
      <label className="text-xs">Branch<Select name="branchId" defaultValue={branchId ?? ""} disabled={lockBranch} className="mt-1 w-44"><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
      <label className="text-xs">Doctor<Select name="doctorId" defaultValue={doctorId ?? ""} className="mt-1 w-48"><option value="">All doctors</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</Select></label>
      <Button type="submit">Apply</Button>
    </form>
  );
}
