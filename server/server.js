require("./loadEnv");
const mongoose = require("mongoose");
const Project = require("./model/project.model");
const { migrateLegacyPhoto } = require("./services/photoStorage");
const { createApp } = require("./createApp");

const PORT = process.env.PORT || 5055;
const mongoUri = process.env.MONGO_URI;
const isDev = process.env.DEV === "true";

const app = createApp();

app.listen(PORT, "0.0.0.0", () => {
  connect();
  console.log(`Captain John op http://localhost:${PORT} (API + client)`);
});

async function migrateLegacyPhotos() {
  const projects = await Project.find({
    photos: {
      $elemMatch: {
        fileId: { $exists: false },
        filename: { $exists: true },
      },
    },
  });
  let migrated = 0;
  for (const project of projects) {
    for (const photo of project.photos) {
      if (photo.fileId) continue;
      const before = photo.fileId;
      await migrateLegacyPhoto(project, photo);
      if (photo.fileId && String(photo.fileId) !== String(before)) migrated += 1;
    }
  }
  if (migrated) {
    console.log(`Legacy foto's gemigreerd naar GridFS: ${migrated}`);
  }
}

async function connect() {
  try {
    await mongoose.connect(mongoUri);
    mongoose.set("debug", { shell: isDev });
    console.log("Successful connection to MongoDB (project-captainjohn)");
    await migrateLegacyPhotos();
  } catch (error) {
    console.log(error);
  }
}

module.exports = { app };
