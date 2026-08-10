require("../server/loadEnv");
const mongoose = require("mongoose");
const User = require("../server/model/user.model");

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/make-admin.js <email>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { roles: ["admin", "editor"], active: true } },
    { new: true }
  ).select("-pw");

  if (!user) {
    console.error("User niet gevonden:", email);
    process.exit(1);
  }

  console.log("Admin gezet:", {
    email: user.email,
    roles: user.roles,
    active: user.active,
  });
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
