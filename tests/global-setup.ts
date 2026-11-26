import { execSync } from "node:child_process";
import { assertDestructiveSetupAllowed } from "./db-guard";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://medora@localhost:5432/medora_test?schema=public";
  assertDestructiveSetupAllowed(url);
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
