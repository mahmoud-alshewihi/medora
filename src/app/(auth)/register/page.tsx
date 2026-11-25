"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export default function Register() {
  const router = useRouter();
  const clinics = useQuery({ queryKey: ["pub-clinics"], queryFn: () => api<{ slug: string; name: string }[]>("/api/public/clinics") });
  const [f, setF] = useState({ clinicSlug: "", fullName: "", email: "", phone: "", password: "" }); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await api("/api/portal/register", { body: f });
      const r = await authClient.signIn.email({ email: f.email, password: f.password });
      if (r.error) throw new Error(r.error.message);
      toast.success("Account created"); router.push("/portal"); router.refresh();
    } catch (err) { toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Registration failed"); } finally { setBusy(false); }
  }
  return (
    <main className="grid min-h-screen place-items-center p-4"><Card className="w-full max-w-md space-y-3 p-6"><h1 className="text-xl font-semibold">Patient registration</h1>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Clinic"><Select required value={f.clinicSlug} onChange={(e) => setF({ ...f, clinicSlug: e.target.value })}><option value="">Select clinic</option>{clinics.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</Select></Field>
        <Field label="Full name"><Input required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label="Phone"><Input required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password (min 8 characters)"><Input required minLength={8} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Button className="w-full" disabled={busy}>{busy ? "Creating..." : "Create account"}</Button></form>
      <p className="text-sm">Already registered? <Link className="text-primary" href="/login">Sign in</Link></p></Card></main>
  );
}
