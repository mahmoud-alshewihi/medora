import { execSync, spawn, type ChildProcess } from "node:child_process";
import { assertDestructiveSetupAllowed } from "../db-guard";

const PORT = 3100;
export const BASE = `http://localhost:${PORT}`;

let server: ChildProcess | undefined;

async function waitForHealth(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server did not become healthy in time");
}

export default async function setup() {
  const url = process.env.HTTP_TEST_DATABASE_URL ?? "postgresql://medora@localhost:5432/medora_http_test?schema=public";
  assertDestructiveSetupAllowed(url);
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  execSync("npx tsx tests/http/seed-fixtures.ts", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      DATABASE_URL: url,
      BETTER_AUTH_SECRET: "http-test-secret-http-test-secret-1234",
      BETTER_AUTH_URL: BASE,
      NEXT_PUBLIC_APP_URL: BASE,
      AUTH_SIGNIN_MAX: "200",
      UPLOAD_DIR: "/tmp/medora-http-uploads",
    },
    stdio: "pipe",
  });
  server.on("error", (e) => console.error("server spawn error", e));
  await waitForHealth(120_000);
  return async () => { server?.kill("SIGTERM"); };
}
