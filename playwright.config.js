const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.PORT || 5055);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // "Film" van de testrun
    video: "on",
    locale: "nl-NL",
    ...devices["Desktop Chrome"],
  },
  outputDir: "test-results",
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "node scripts/test-server.js",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          NODE_ENV: "test",
          ALLOW_NO_CLIENT: "false",
          PORT: String(PORT),
          MONGO_URI:
            process.env.MONGO_URI ||
            "mongodb://127.0.0.1:27017/project-captainjohn-e2e",
          MONGO_SESSION_URI:
            process.env.MONGO_SESSION_URI ||
            process.env.MONGO_URI ||
            "mongodb://127.0.0.1:27017/project-captainjohn-e2e",
          SESSION_SECRET: process.env.SESSION_SECRET || "e2e-session-secret",
          ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
          COOKIE_SECURE: "false",
          DEV: "false",
        },
      },
});
