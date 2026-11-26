"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Megaphone, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";
import { T, useTx } from "@/components/t";
import { toast } from "sonner";

function useStatusPatch() {
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();
  const tx = useTx();
  const patch = async (id: string, to: string) => {
    setBusy(true);
    try {
      await api(`/api/appointments/${id}`, { method: "PATCH", body: { action: "status", to } });
      toast.success(tx("Status updated"));
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };
  return { busy, patch };
}

export function CheckInButton({ id }: { id: string }) {
  const { busy, patch } = useStatusPatch();
  return <Button size="sm" variant="soft" disabled={busy} onClick={() => void patch(id, "CHECKED_IN")}><UserCheck className="h-3.5 w-3.5" /><T>Check in</T></Button>;
}

export function CallButton({ id }: { id: string }) {
  const { busy, patch } = useStatusPatch();
  return <Button size="sm" variant="outline" disabled={busy} onClick={() => void patch(id, "WAITING")}><Megaphone className="h-3.5 w-3.5" /><T>Call</T></Button>;
}
