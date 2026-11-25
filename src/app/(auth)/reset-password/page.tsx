"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth-client";

function Form() {
  const token = useSearchParams().get("token") ?? ""; const router = useRouter(); const [pw, setPw] = useState("");
  return (
    <main className="grid min-h-screen place-items-center p-4"><Card className="w-full max-w-sm space-y-3 p-6"><h1 className="text-xl font-semibold">Choose a new password</h1>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const r = await authClient.resetPassword({ newPassword: pw, token }); if (r.error) toast.error(r.error.message ?? "Invalid or expired link"); else { toast.success("Password updated"); router.push("/login"); } }}>
        <Field label="New password"><Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></Field><Button className="w-full" disabled={!token}>Update password</Button></form></Card></main>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
