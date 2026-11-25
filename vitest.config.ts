import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node", include: ["tests/**/*.test.ts"], fileParallelism: false, testTimeout: 30000, hookTimeout: 120000,
    globalSetup: ["tests/global-setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://medora@localhost:5432/medora_test?schema=public",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123456",
      BETTER_AUTH_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
  },
});
