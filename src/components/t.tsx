"use client";
import { createContext, useContext } from "react";
import { AR } from "@/lib/i18n/phrases";

const LocaleCtx = createContext<"en" | "ar">("en");
export const LocaleProvider = LocaleCtx.Provider;
/** Translates a known UI phrase to Arabic in Arabic mode; unknown phrases stay English. */
export function T({ children }: { children: string }) {
  const l = useContext(LocaleCtx);
  return <>{l === "ar" ? AR[children] ?? children : children}</>;
}
export function useTx() { const l = useContext(LocaleCtx); return (s: string) => (l === "ar" ? AR[s] ?? s : s); }
