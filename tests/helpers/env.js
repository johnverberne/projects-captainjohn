const path = require("path");
const dotenv = require("dotenv");

process.env.NODE_ENV = "test";
process.env.ALLOW_NO_CLIENT = "true";
process.env.SESSION_SECRET = "test-session-secret";
process.env.ADMIN_EMAIL = "admin@example.com";
process.env.COOKIE_SECURE = "false";
process.env.DEV = "false";

if (!process.env.MONGO_URI) {
  dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
}

function toTestUri(uri) {
  if (!uri) return uri;
  return String(uri).replace(
    /\/project-captainjohn(\?|$)/,
    "/project-captainjohn-test$1"
  );
}

if (process.env.MONGO_URI) {
  process.env.MONGO_URI = toTestUri(process.env.MONGO_URI);
} else {
  process.env.MONGO_URI =
    "mongodb://127.0.0.1:27017/project-captainjohn-test";
}
process.env.MONGO_SESSION_URI =
  process.env.MONGO_SESSION_URI || process.env.MONGO_URI;
