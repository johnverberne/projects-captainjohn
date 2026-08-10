const { spawnSync } = require("child_process");
const path = require("path");

const clientDir = path.join(__dirname, "..", "client");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: clientDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status) process.exit(result.status ?? 1);
}

run("npm", ["install"]);
run("npm", ["run", "build"]);
