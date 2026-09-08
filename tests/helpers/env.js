const path = require("path");
const dotenv = require("dotenv");
const { withDbSuffix } = require("../../server/dbUri");

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
  return withDbSuffix(uri, "test");
}

if (process.env.MONGO_URI) {
  process.env.MONGO_URI = toTestUri(process.env.MONGO_URI);
} else {
  process.env.MONGO_URI =
    "mongodb://127.0.0.1:27017/project-captainjohn-test";
}
// Ook een expliciete sessie-URI moet naar de testdatabase, anders schrijven
// tests in de echte database.
process.env.MONGO_SESSION_URI = process.env.MONGO_SESSION_URI
  ? toTestUri(process.env.MONGO_SESSION_URI)
  : process.env.MONGO_URI;
