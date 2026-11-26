/* Before/after screenshot harness: signs in via the real auth API, injects the session cookie,
   visits each page, captures full-height screenshots at a given width. Usage:
   PW_CHROME=/usr/bin/google-chrome npx tsx scripts/screenshot.mts <outDir> [width] [theme] [locale] */
import { chromium, type BrowserContext } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "/tmp/shots/before";
const WIDTH = Number(process.argv[3] ?? 1440);
const THEME = process.argv[4] ?? "light";
const LOCALE = process.argv[5] ?? "en";
const PORT = 3400, BASE = `http://localhost:${PORT}`;
const PW = "Medora#Demo2026";

const PAGES: { name: string; url: string; role?: string; email?: string }[] = [
  { name: "home", url: "/" },
  { name: "clinic-page", url: "/c/nile-care" },
  { name: "clinic-book", url: "/c/nile-care/book" },
  { name: "login", url: "/login" },
  { name: "admin-dashboard", url: "/admin", email: "owner@nile.medora.test" },
  { name: "admin-patients", url: "/admin/patients", email: "owner@nile.medora.test" },
  { name: "admin-appointments", url: "/admin/appointments", email: "owner@nile.medora.test" },
  { name: "admin-billing", url: "/admin/billing", email: "owner@nile.medora.test" },
  { name: "admin-reports", url: "/admin/reports", email: "owner@nile.medora.test" },
  { name: "admin-inventory", url: "/admin/inventory", email: "owner@nile.medora.test" },
  { name: "admin-staff", url: "/admin/staff", email: "owner@nile.medora.test" },
  { name: "admin-settings", url: "/admin/settings", email: "owner@nile.medora.test" },
  { name: "notifications", url: "/notifications", email: "owner@nile.medora.test" },
  { name: "doctor-home", url: "/doctor", email: "doctor@nile.medora.test" },
  { name: "reception", url: "/reception", email: "reception@nile.medora.test" },
  { name: "portal-home", url: "/portal", email: "patient@nile.medora.test" },
  { name: "portal-book", url: "/portal/book", email: "patient@nile.medora.test" },
];

async function waitHealth(server: ChildProcess) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return; } catch { }
    if (server.exitCode !== null) throw new Error("server exited");
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("health timeout");
}
import { existsSync } from "node:fs";
async function signInState(browser: import("playwright").Browser, email: string): Promise<string> {
  const file = `/tmp/shots/state-${email}.json`;
  if (existsSync(file)) return file;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PW);
  await page.getByRole("button", { name: /sign in|log in|تسجيل/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 });
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env: { ...process.env, DATABASE_URL: "postgresql://medora:medora@127.0.0.1:5433/medora", BETTER_AUTH_SECRET: "shot-secret-shot-secret-shot-secret-1", BETTER_AUTH_URL: BASE, NEXT_PUBLIC_APP_URL: BASE, AUTH_SIGNIN_MAX: "200" }, stdio: "ignore" });
try {
  await waitHealth(server);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  const states = new Map<string, string>();
  let ctx: BrowserContext | undefined;
  for (const p of PAGES) {
    if (existsSync(`${OUT}/${p.name}.png`)) { console.log("skip", p.name); continue; }
    if (p.email && !states.has(p.email)) { try { states.set(p.email, await signInState(browser, p.email)); } catch (e) { console.log("LOGIN-FAIL", p.email, String(e).slice(0, 80)); continue; } }
    await ctx?.close().catch(() => undefined);
    ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, locale: LOCALE === "ar" ? "ar-EG" : "en-US", colorScheme: THEME === "dark" ? "dark" : "light", ...(p.email ? { storageState: states.get(p.email) } : {}) });
    await ctx.addCookies([{ name: "locale", value: LOCALE, url: BASE }]);
    await ctx.addInitScript(([theme, locale]) => { localStorage.setItem("theme", theme as string); localStorage.setItem("medora-locale", locale as string); document.documentElement.classList.toggle("dark", theme === "dark"); }, [THEME, LOCALE]);
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: false });
      console.log("shot", p.name);
    } catch (e) { console.log("FAIL", p.name, String(e).slice(0, 120)); }
    await page.close();
  }
  await ctx?.close();
  await browser.close();
} finally { server.kill("SIGTERM"); }
process.exit(0);
