"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/primitives";

export function CancelButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go() {
    if (!window.confirm("Cancel this appointment?")) return;
    setBusy(true); setErr("");
    try { await api("/api/portal/appointments", { method: "PATCH", body: { action: "cancel", appointmentId } }); router.refresh(); } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return <span><Button variant="outline" disabled={busy} onClick={go}><T>Cancel</T></Button>{err && <span role="alert" className="ms-2 text-xs text-red-600">{err}</span>}</span>;
}
