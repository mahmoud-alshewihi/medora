"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-[60vh] place-items-center p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center" role="alert">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger"><AlertTriangle className="h-7 w-7" /></span>
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">An unexpected error occurred. You can try again; if it keeps happening, contact the clinic.</p>
        <Button onClick={reset} className="mt-1">Try again</Button>
      </div>
    </main>
  );
}
