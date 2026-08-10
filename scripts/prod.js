const { spawn } = require("child_process");
const path = require("path");

process.env.DEV = "false";

const child = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
