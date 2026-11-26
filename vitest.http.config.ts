import { defineConfig } from "vitest/config";
import path from "node:path";

// HTTP-layer security tests: boot the REAL Next.js server (next start) against an
// isolated database and attack real endpoints with real session cookies.
// Requires `npm run build` to have run (CI builds before tests).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/http/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 300000,
    globalSetup: ["tests/http/global-setup.ts"],
    env: {
      DATABASE_URL: process.env.HTTP_TEST_DATABASE_URL ?? "postgresql://medora@localhost:5432/medora_http_test?schema=public",
      BETTER_AUTH_SECRET: "http-test-secret-http-test-secret-1234",
      BETTER_AUTH_URL: "http://localhost:3100",
      NODE_ENV: "test",
    },
  },
});
