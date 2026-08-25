process.env.NODE_ENV = process.env.NODE_ENV || "test";
require("../server/loadEnv");

const mongoose = require("mongoose");
const argon2 = require("argon2");
const { withDbSuffix } = require("../server/dbUri");
const User = require("../server/model/user.model");
const Project = require("../server/model/project.model");

const email = (process.env.E2E_EMAIL || "e2e@example.com").toLowerCase();
const password = process.env.E2E_PASSWORD || "e2e-pass-123";
const name = process.env.E2E_NAME || "E2E Tester";

async function main() {
  const uri = withDbSuffix(
    process.env.MONGO_URI ||
      "mongodb://127.0.0.1:27017/project-captainjohn-e2e",
    "e2e"
  );
  await mongoose.connect(uri);

  await User.deleteMany({ email });
  await Project.deleteMany({ ownerEmail: email });

  const hash = await argon2.hash(password);
  await User.create({
    email,
    name,
    pw: hash,
    roles: ["editor", "admin"],
    active: true,
  });

  await Project.create({
    title: "E2E showcase project",
    type: "glasfusion",
    glasfusionTechnique: "fuse",
    glasfusionSpeed: "medium",
    notes: "Alleen zichtbaar in beheer",
    ownerEmail: email,
    saleStatus: "showroom",
    saleTitle: "E2E showcase project",
    labels: [{ name: "E2E", color: "#2f6b4f" }],
    photos: [],
    steps: [],
  });

  console.log(`E2E user klaar: ${email} / ${password}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
