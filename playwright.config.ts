import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["*.e2e.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 12_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"],["html",{open:"never"}]] : "list",
  use: {
    baseURL:"http://127.0.0.1:4173",
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    ...devices["Desktop Chrome"]
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
