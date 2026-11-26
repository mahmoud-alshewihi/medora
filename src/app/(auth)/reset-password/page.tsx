"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, Field, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/shell/auth-shell";
import { authClient } from "@/lib/auth-client";

function Form() {
  const token = useSearchParams().get("token") ?? ""; const router = useRouter(); const [pw, setPw] = useState("");
  return (
    <AuthShell title="Choose a new password" subtitle="Minimum 8 characters.">
      <Card><CardContent className="pt-5">
        <form className="space-y-3.5" onSubmit={async (e) => { e.preventDefault(); const r = await authClient.resetPassword({ newPassword: pw, token }); if (r.error) toast.error(r.error.message ?? "Invalid or expired link"); else { toast.success("Password updated"); router.push("/login"); } }}>
          <Field label="New password"><Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Button className="w-full" size="lg" disabled={!token}>Update password</Button>
        </form>
      </CardContent></Card>
    </AuthShell>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
