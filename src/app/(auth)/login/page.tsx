"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, Field, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/shell/auth-shell";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

function LoginForm() {
  const router = useRouter(); const sp = useSearchParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const err = sp.get("error");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (r.error) { toast.error(r.error.message ?? "Sign-in failed"); return; }
    const me = await fetch("/api/me").then((x) => x.json());
    router.push(me.data?.home ?? "/"); router.refresh();
  }
  return (
    <AuthShell title="Sign in" subtitle="Staff and patients use the same sign-in.">
      <Card><CardContent className="space-y-4 pt-5">
        {err ? <p role="alert" className="rounded-md bg-danger-soft p-2.5 text-sm text-danger">Access problem: {err.replace(/_/g, " ").toLowerCase()}</p> : null}
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" htmlFor="password"><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button className="w-full" size="lg" disabled={busy} type="submit">{busy ? "Signing in..." : "Sign in"}</Button>
        </form>
        <div className="flex justify-between text-sm"><Link className="text-primary hover:underline" href="/forgot-password">Forgot password?</Link><Link className="text-primary hover:underline" href="/register">Patient registration</Link></div>
      </CardContent></Card>
    </AuthShell>
  );
}
export default function Page() { return <Suspense><LoginForm /></Suspense>; }
