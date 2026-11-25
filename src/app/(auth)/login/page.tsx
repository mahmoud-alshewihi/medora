"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
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
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div><h1 className="text-xl font-semibold">Sign in to Medora</h1><p className="text-sm text-muted-foreground">Staff and patients use the same sign-in.</p></div>
        {err ? <p role="alert" className="rounded bg-danger/10 p-2 text-sm text-danger">Access problem: {err.replace(/_/g, " ").toLowerCase()}</p> : null}
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" htmlFor="password"><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button className="w-full" disabled={busy} type="submit">{busy ? "Signing in..." : "Sign in"}</Button>
        </form>
        <div className="flex justify-between text-sm"><Link className="text-primary" href="/forgot-password">Forgot password?</Link><Link className="text-primary" href="/register">Patient registration</Link></div>
      </Card>
    </main>
  );
}
export default function Page() { return <Suspense><LoginForm /></Suspense>; }
