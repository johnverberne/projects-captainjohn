const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Project .env eerst
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Mail/admin-config overnemen uit bdeditor als die lokaal aanwezig is
const MAIL_KEYS = [
  "ADMIN_EMAIL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "FROM_EMAIL",
];

const bdeditorEnvPath = path.resolve(__dirname, "..", "..", "bdeditor", ".env");
if (fs.existsSync(bdeditorEnvPath)) {
  const parsed = dotenv.parse(fs.readFileSync(bdeditorEnvPath));
  for (const key of MAIL_KEYS) {
    if (!process.env[key] && parsed[key]) {
      process.env[key] = parsed[key];
    }
  }
}

// Zelfde default als bdeditor
if (!process.env.ADMIN_EMAIL) {
  process.env.ADMIN_EMAIL = "john.verberne@gmail.com";
}
