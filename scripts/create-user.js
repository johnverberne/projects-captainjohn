require("../server/loadEnv");
const mongoose = require("mongoose");
const argon2 = require("argon2");
const User = require("../server/model/user.model");

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const password = process.argv[3] || "";
  const name = process.argv[4] || email.split("@")[0];

  if (!email || !password) {
    console.error("Usage: node scripts/create-user.js <email> <password> [name]");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const hash = await argon2.hash(password);
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        name,
        pw: hash,
        roles: ["admin", "editor"],
        active: true,
        loginCount: 0,
        lastLogin: "",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select("-pw");

  console.log("User ready:", {
    email: user.email,
    name: user.name,
    roles: user.roles,
    id: user._id,
  });
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
