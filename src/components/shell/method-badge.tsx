import { Banknote, CreditCard, Landmark, Smartphone } from "lucide-react";
import { T } from "@/components/t";

export function MethodBadge({ method }: { method: string }) {
  const map: Record<string, { icon: typeof Banknote; label: string }> = {
    CASH: { icon: Banknote, label: "Cash" }, CARD: { icon: CreditCard, label: "Card (recorded offline)" },
    BANK_TRANSFER: { icon: Landmark, label: "Bank transfer" }, MOBILE_WALLET: { icon: Smartphone, label: "Mobile wallet" },
  };
  const m = map[method] ?? { icon: Banknote, label: method };
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"><m.icon className="h-3.5 w-3.5 text-muted-foreground" /><T>{m.label}</T></span>;
}
