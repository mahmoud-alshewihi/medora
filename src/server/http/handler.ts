import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireAccess, type AccessContext } from "@/server/auth/access";
import type { Permission } from "@/server/auth/permissions";

export function jsonError(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: e.flatten() } }, { status: 422 });
  logger.error("unhandled error", { err: e instanceof Error ? e.message : String(e) });
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

/** CSRF defence for cookie-authenticated mutations: reject cross-origin browser requests. */
function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new AppError(403, "CSRF", "Cross-origin request blocked");
}

export interface Ctx2 { req: Request; ctx: AccessContext & { clinicId: string }; params: Record<string, string>; url: URL }

export function secured<S extends ZodTypeAny | undefined = undefined>(
  permission: Permission,
  opts: { write?: boolean; body?: S },
  fn: (c: Ctx2 & { body: S extends ZodTypeAny ? z.infer<S> : undefined }) => Promise<unknown>,
) {
  return async (req: Request, route: { params: Promise<Record<string, string>> }) => {
    try {
      assertSameOrigin(req);
      const ctx = await requireAccess(permission, { write: opts.write ?? req.method !== "GET" });
      const params = await route.params;
      const body = opts.body ? opts.body.parse(await req.json().catch(() => { throw new AppError(400, "BAD_JSON", "Body must be valid JSON"); })) : undefined;
      const result = await fn({ req, ctx, params, url: new URL(req.url), body: body as never });
      if (result instanceof Response) return result;
      return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) { return jsonError(e); }
  };
}

/** For endpoints with their own auth rules (public, platform, portal). */
export function open(fn: (req: Request, params: Record<string, string>) => Promise<unknown>, guard?: (req: Request) => void | Promise<void>) {
  return async (req: Request, route: { params: Promise<Record<string, string>> }) => {
    try {
      assertSameOrigin(req);
      await guard?.(req);
      const result = await fn(req, await route.params);
      if (result instanceof Response) return result;
      return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) { return jsonError(e); }
  };
}

// Simple in-memory sliding window rate limiter (per process). Use Redis for multi-instance production.
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) throw new AppError(429, "RATE_LIMITED", "Too many requests, please try again shortly");
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
