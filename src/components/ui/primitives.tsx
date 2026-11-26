"use client";
import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/components/t";

/* ── Button ─────────────────────────────────────────────────── */
type BtnVariant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "soft";
type BtnSize = "sm" | "md" | "lg" | "icon";
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }>(
  ({ className, variant = "primary", size = "md", ...p }, ref) => (
    <button ref={ref} className={cn(
      "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-fast ease-smooth focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
      size === "sm" && "h-8 px-3 text-[13px]",
      size === "md" && "h-9 px-4 text-sm",
      size === "lg" && "h-11 px-5 text-[15px]",
      size === "icon" && "h-9 w-9",
      variant === "primary" && "bg-primary text-primary-foreground shadow-xs hover:bg-primary-strong",
      variant === "secondary" && "bg-navy text-white shadow-xs hover:opacity-90 dark:bg-card dark:text-foreground dark:border",
      variant === "outline" && "border bg-card shadow-xs hover:bg-muted hover:text-foreground",
      variant === "danger" && "bg-danger text-white shadow-xs hover:opacity-90",
      variant === "soft" && "bg-primary-soft text-primary hover:bg-primary-soft/70",
      variant === "ghost" && "hover:bg-muted hover:text-foreground", className)} {...p} />
  ));
Button.displayName = "Button";

/* ── Form controls ──────────────────────────────────────────── */
const controlBase =
  "block w-full rounded-md border border-input bg-card text-sm shadow-xs transition-colors placeholder:text-muted-foreground hover:border-muted-foreground/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(controlBase, "h-9 px-3", className)} {...p} />
));
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(controlBase, "h-9 px-2.5 pe-8 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222.5%22 stroke-linecap=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[position:right_0.6rem_center] bg-no-repeat [dir=rtl]:bg-[position:left_0.6rem_center]", className)} {...p} />
));
Select.displayName = "Select";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(controlBase, "min-h-20 px-3 py-2", className)} {...p} />
));
Textarea.displayName = "Textarea";

export function Field({ label, error, children, htmlFor, hint }: { label: React.ReactNode; error?: string; children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground/90">{label}</label>
      {children}
      {error ? <p role="alert" className="text-xs font-medium text-danger">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ── Card family ────────────────────────────────────────────── */
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-card shadow-xs", className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-4 pb-3", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[15px] font-semibold tracking-tight", className)} {...p} />;
}
export function CardDescription({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] text-muted-foreground", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...p} />;
}
export function CardFooter({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 border-t px-5 py-3", className)} {...p} />;
}

/* ── Badge ──────────────────────────────────────────────────── */
const tones: Record<string, string> = {
  PENDING: "bg-warn-soft text-warn", CONFIRMED: "bg-info-soft text-info", CHECKED_IN: "bg-info-soft text-info", WAITING: "bg-warn-soft text-warn",
  IN_PROGRESS: "bg-primary-soft text-primary", COMPLETED: "bg-success-soft text-success", CANCELLED: "bg-danger-soft text-danger", NO_SHOW: "bg-danger-soft text-danger",
  PAID: "bg-success-soft text-success", PARTIALLY_PAID: "bg-warn-soft text-warn", ISSUED: "bg-info-soft text-info", UNPAID: "bg-danger-soft text-danger",
  VOID: "bg-muted text-muted-foreground", REFUNDED: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success-soft text-success", SUSPENDED: "bg-danger-soft text-danger", ARCHIVED: "bg-muted text-muted-foreground",
};
export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[value] ?? "bg-muted text-muted-foreground", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      <T>{value.replace(/_/g, " ")}</T>
    </span>
  );
}

/* ── States ─────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) { return <div className={cn("skeleton h-4 w-full", className)} aria-hidden />; }

export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      {icon ? <div className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-[13px] text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft/60 p-4 text-sm">
      <p className="font-medium text-danger">{message}</p>
      {onRetry ? <Button className="mt-2.5" size="sm" variant="outline" onClick={onRetry}>Retry</Button> : null}
    </div>
  );
}

/* ── Dialogs & menus ────────────────────────────────────────── */
export function ConfirmDialog({ trigger, title, description, confirmLabel = "Confirm", destructive, onConfirm }: { trigger: React.ReactNode; title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void> }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="overlay-in fixed inset-0 z-40 bg-navy/50 backdrop-blur-[2px]" />
        <AlertDialog.Content className="zoom-in fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md rounded-xl border bg-card p-5 shadow-xl">
          <AlertDialog.Title className="text-[15px] font-semibold tracking-tight">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild><Button variant="outline"><T>Cancel</T></Button></AlertDialog.Cancel>
            <AlertDialog.Action asChild><Button variant={destructive ? "danger" : "primary"} onClick={() => void onConfirm()}>{confirmLabel}</Button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function Modal({ trigger, title, description, children, wide }: { trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-in fixed inset-0 z-40 bg-navy/50 backdrop-blur-[2px]" />
        <Dialog.Content className={cn("zoom-in fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-5 shadow-xl", wide ? "max-w-2xl" : "max-w-md")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[15px] font-semibold tracking-tight">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close" className="h-8 w-8 shrink-0"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Slide-over detail panel, right edge (left in RTL). */
export function Sheet({ trigger, title, children, open, onOpenChange }: { trigger?: React.ReactNode; title: string; children: React.ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-in fixed inset-0 z-40 bg-navy/50 backdrop-blur-[2px]" />
        <Dialog.Content className="sheet-in fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <Dialog.Title className="text-[15px] font-semibold tracking-tight">{title}</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close" className="h-8 w-8"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export function MenuContent({ children, align = "end" }: { children: React.ReactNode; align?: "start" | "center" | "end" }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content align={align} sideOffset={6} className="fade-in z-50 min-w-44 rounded-lg border bg-card p-1 shadow-lg">
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}
export function MenuItem({ className, ...p }: DropdownMenu.DropdownMenuItemProps) {
  return <DropdownMenu.Item className={cn("flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...p} />;
}
export const MenuSeparator = () => <DropdownMenu.Separator className="my-1 h-px bg-border" />;

/* ── Tabs ───────────────────────────────────────────────────── */
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <TabsPrimitive.List className={cn("inline-flex items-center gap-1 rounded-lg bg-muted p-1", className)} {...p} />;
}
export function TabsTrigger({ className, value, children }: { className?: string; value: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger value={value} className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs", className)}>
      {children}
    </TabsPrimitive.Trigger>
  );
}
export const TabsContent = TabsPrimitive.Content;
