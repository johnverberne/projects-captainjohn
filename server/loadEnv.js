const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.ADMIN_EMAIL) {
  process.env.ADMIN_EMAIL = "john.verberne@gmail.com";
}
