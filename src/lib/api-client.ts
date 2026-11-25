"use client";
export class ApiError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } }

export async function api<T>(path: string, init: { method?: string; body?: unknown; raw?: BodyInit } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body || init.raw ? "POST" : "GET"),
    headers: init.raw ? undefined : init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.raw ?? (init.body ? JSON.stringify(init.body) : undefined),
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { code: string; message: string; details?: unknown } };
  if (!res.ok) throw new ApiError(res.status, json.error?.code ?? "ERROR", json.error?.message ?? "Request failed", json.error?.details);
  return json.data as T;
}
