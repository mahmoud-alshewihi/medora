"use client";
import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { T } from "@/components/t";

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "danger" | "ghost"; size?: "sm" | "md" }>(
  ({ className, variant = "primary", size = "md", ...p }, ref) => (
    <button ref={ref} className={cn("inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
      size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
      variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
      variant === "outline" && "border bg-card hover:bg-muted",
      variant === "danger" && "bg-danger text-white hover:opacity-90",
      variant === "ghost" && "hover:bg-muted", className)} {...p} />
  ));
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("block h-10 w-full rounded-md border bg-card px-3 text-sm placeholder:text-muted-foreground disabled:opacity-60", className)} {...p} />
));
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn("block h-10 w-full rounded-md border bg-card px-2 text-sm", className)} {...p} />
));
Select.displayName = "Select";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn("min-h-20 w-full rounded-md border bg-card px-3 py-2 text-sm", className)} {...p} />
));
Textarea.displayName = "Textarea";

export function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border bg-card", className)} {...p} />;
}

const tones: Record<string, string> = {
  PENDING: "bg-warn/15 text-warn", CONFIRMED: "bg-primary/15 text-primary", CHECKED_IN: "bg-primary/15 text-primary", WAITING: "bg-warn/15 text-warn",
  IN_PROGRESS: "bg-navy/15 text-navy", COMPLETED: "bg-success/15 text-success", CANCELLED: "bg-danger/15 text-danger", NO_SHOW: "bg-danger/15 text-danger",
  PAID: "bg-success/15 text-success", PARTIALLY_PAID: "bg-warn/15 text-warn", ISSUED: "bg-navy/15 text-navy", VOID: "bg-muted text-muted-foreground", REFUNDED: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success/15 text-success", SUSPENDED: "bg-danger/15 text-danger",
};
export function Badge({ value }: { value: string }) {
  return <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium", tones[value] ?? "bg-muted text-muted-foreground")}><T>{value.replace(/_/g, " ")}</T></span>;
}

export function Skeleton({ className }: { className?: string }) { return <div className={cn("skeleton h-4 w-full", className)} aria-hidden />; }

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><p className="font-medium text-foreground">{title}</p>{hint ? <p className="mt-1">{hint}</p> : null}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm"><p className="text-danger">{message}</p>{onRetry ? <Button className="mt-2" size="sm" variant="outline" onClick={onRetry}>Retry</Button> : null}</div>;
}

export function ConfirmDialog({ trigger, title, description, confirmLabel = "Confirm", destructive, onConfirm }: { trigger: React.ReactNode; title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void> }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-5 shadow-lg">
          <AlertDialog.Title className="font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">{description}</AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild><Button variant="outline">Cancel</Button></AlertDialog.Cancel>
            <AlertDialog.Action asChild><Button variant={destructive ? "danger" : "primary"} onClick={() => void onConfirm()}>{confirmLabel}</Button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
