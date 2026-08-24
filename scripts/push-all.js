#!/usr/bin/env node
const { spawnSync } = require("child_process");

function run(args) {
  const result = spawnSync("git", args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run(["push", "origin", "HEAD"]);
run(["push", "codeberg", "HEAD"]);
