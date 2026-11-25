"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/primitives";
export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  return <Button variant="outline" disabled={disabled || busy} onClick={async () => { setBusy(true); try { await api("/api/notifications", { method: "POST" }); router.refresh(); } finally { setBusy(false); } }}>Mark all as read</Button>;
}
