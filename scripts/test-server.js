/**
 * Start de app voor Playwright E2E (build + seed + listen).
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.ALLOW_NO_CLIENT = "false";
process.env.COOKIE_SECURE = "false";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const distIndex = path.join(__dirname, "..", "client", "dist", "index.html");
if (!fs.existsSync(distIndex)) {
  console.log("Client-build ontbreekt — npm run build…");
  const built = spawnSync("npm", ["run", "build"], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  });
  if (built.status !== 0) process.exit(built.status || 1);
}

const seeded = spawnSync("node", ["scripts/seed-e2e.js"], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  shell: true,
  env: process.env,
});
if (seeded.status !== 0) process.exit(seeded.status || 1);

require("../server/loadEnv");
const mongoose = require("mongoose");
const { createApp } = require("../server/createApp");

const PORT = process.env.PORT || 5055;
const mongoUri = process.env.MONGO_URI;

async function main() {
  await mongoose.connect(mongoUri);
  const app = createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`E2E server op http://127.0.0.1:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
