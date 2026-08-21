require("./env");
const mongoose = require("mongoose");
const argon2 = require("argon2");
const User = require("../../server/model/user.model");
const Project = require("../../server/model/project.model");
const Label = require("../../server/model/label.model");

const TEST_USER = {
  email: "tester@example.com",
  password: "test-pass-123",
  name: "Test Gebruiker",
  roles: ["editor", "admin"],
};

async function connectTestDb() {
  const uri = process.env.MONGO_URI;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
  // GridFS buckets
  try {
    const db = mongoose.connection.db;
    await db.collection("photos.files").deleteMany({});
    await db.collection("photos.chunks").deleteMany({});
  } catch {
    /* ignore if missing */
  }
}

async function seedUser(overrides = {}) {
  const email = (overrides.email || TEST_USER.email).toLowerCase();
  const password = overrides.password || TEST_USER.password;
  const hash = await argon2.hash(password);
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        name: overrides.name || TEST_USER.name,
        pw: hash,
        roles: overrides.roles || TEST_USER.roles,
        active: true,
        loginCount: 0,
        lastLogin: "",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select("-pw");
  return { user, email, password };
}

async function seedPublicProject() {
  return Project.create({
    title: "Publiek testproject",
    type: "overige",
    notes: "Voor publieke tests",
    ownerEmail: TEST_USER.email,
    saleStatus: "showroom",
    labels: [{ name: "Demo", color: "#b85c38" }],
    photos: [],
    steps: [],
  });
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  TEST_USER,
  connectTestDb,
  clearDb,
  seedUser,
  seedPublicProject,
  disconnectTestDb,
  User,
  Project,
  Label,
};
