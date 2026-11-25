"use client";
import { useTheme } from "next-themes";
import { Moon, Sun, Languages, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth-client";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return <Button variant="ghost" size="sm" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><Sun className="h-4 w-4 dark:hidden" /><Moon className="hidden h-4 w-4 dark:block" /></Button>;
}
export function LocaleToggle({ current }: { current: "en" | "ar" }) {
  const router = useRouter();
  return <Button variant="ghost" size="sm" aria-label="Switch language" onClick={() => { document.cookie = `locale=${current === "en" ? "ar" : "en"}; path=/; max-age=31536000; samesite=lax`; router.refresh(); }}><Languages className="h-4 w-4" />{current === "en" ? "AR" : "EN"}</Button>;
}
export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return <Button variant="ghost" size="sm" onClick={async () => { await authClient.signOut(); router.push("/login"); router.refresh(); }}><LogOut className="h-4 w-4" />{label}</Button>;
}
