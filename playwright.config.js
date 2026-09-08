const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { defineConfig, devices } = require("@playwright/test");
const { withDbSuffix } = require("./server/dbUri");

// .env wordt alleen uitgelezen, niet in process.env gezet. Playwright geeft zijn
// omgeving door aan de workers, en die evalueren deze config opnieuw: een PORT
// uit .env zou daar de baseURL veranderen terwijl de server op een andere poort
// draait.
const envFile = path.join(__dirname, ".env");
const fileEnv = fs.existsSync(envFile)
  ? dotenv.parse(fs.readFileSync(envFile))
  : {};

// Eigen poort, los van de PORT van de app: zo hergebruikt Playwright nooit een
// lokale dev-server, die op de echte database kan zijn aangesloten.
const PORT = Number(process.env.E2E_PORT || 5056);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const LOCAL_E2E_URI = "mongodb://127.0.0.1:27017/project-captainjohn-e2e";
const e2eUri = withDbSuffix(
  process.env.MONGO_URI || fileEnv.MONGO_URI || LOCAL_E2E_URI,
  "e2e"
);

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
          MONGO_URI: e2eUri,
          MONGO_SESSION_URI: e2eUri,
          SESSION_SECRET: process.env.SESSION_SECRET || "e2e-session-secret",
          ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
          COOKIE_SECURE: "false",
          DEV: "false",
        },
      },
});
