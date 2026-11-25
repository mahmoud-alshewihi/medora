import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e", timeout: 60_000, retries: 0, workers: 1,
  use: { baseURL: "http://localhost:3000", channel: process.env.PW_CHANNEL || undefined, launchOptions: { executablePath: process.env.PW_CHROME || undefined } },
  webServer: { command: "npm run build && npm run start", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 240_000 },
});
