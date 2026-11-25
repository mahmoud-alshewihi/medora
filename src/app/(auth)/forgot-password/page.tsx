"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth-client";

export default function Forgot() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center p-4"><Card className="w-full max-w-sm space-y-3 p-6"><h1 className="text-xl font-semibold">Reset password</h1>
      {sent ? <p className="text-sm">If an account exists for that address, a reset link has been requested. If the clinic has not configured an email provider, no email is delivered: an administrator must configure one.</p> :
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const r = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }); if (r.error) toast.error(r.error.message ?? "Failed"); else setSent(true); }}>
          <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Button className="w-full">Send reset link</Button></form>}</Card></main>
  );
}
