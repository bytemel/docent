import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseURL);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 1,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 2,
  fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  outputDir: "test-results/artifacts",
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    locale: "en-GB",
    timezoneId: "Africa/Nairobi",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: local
    ? {
        command: `npx next start -p ${new URL(baseURL).port || "3000"}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
