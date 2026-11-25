"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { LocaleProvider } from "@/components/t";

export function Providers({ children, locale = "en" }: { children: React.ReactNode; locale?: "en" | "ar" }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } } }));
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LocaleProvider value={locale}><QueryClientProvider client={qc}>{children}<Toaster richColors position="top-right" /></QueryClientProvider></LocaleProvider>
    </ThemeProvider>
  );
}
