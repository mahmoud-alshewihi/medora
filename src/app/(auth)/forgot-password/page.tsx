"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, Field, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/shell/auth-shell";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function Forgot() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false);
  return (
    <AuthShell title="Reset password" subtitle="We will send a reset link to your email.">
      <Card><CardContent className="space-y-3.5 pt-5">
        {sent ? (
          <div className="space-y-3">
            <p className="rounded-md bg-success-soft p-3 text-sm text-success">If an account exists for that address, a reset link has been requested. If the clinic has not configured an email provider, no email is delivered: an administrator must configure one.</p>
            <p className="text-sm"><Link className="text-primary hover:underline" href="/login">Back to sign in</Link></p>
          </div>
        ) : (
          <form className="space-y-3.5" onSubmit={async (e) => { e.preventDefault(); const r = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }); if (r.error) toast.error(r.error.message ?? "Failed"); else setSent(true); }}>
            <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Button className="w-full" size="lg">Send reset link</Button>
            <p className="text-sm"><Link className="text-primary hover:underline" href="/login">Back to sign in</Link></p>
          </form>
        )}
      </CardContent></Card>
    </AuthShell>
  );
}
