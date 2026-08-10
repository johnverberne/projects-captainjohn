require("./loadEnv");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const history = require("connect-history-api-fallback");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const projectsRouter = require("./api/projects");
const authRouter = require("./api/auth");
const Project = require("./model/project.model");
const { migrateLegacyPhoto } = require("./services/photoStorage");

const PORT = process.env.PORT || 5055;
const mongoUri = process.env.MONGO_URI;
const mongoSessionUri = process.env.MONGO_SESSION_URI;
const sessionSecret = process.env.SESSION_SECRET || "captainjohn-dev";
const isDev = process.env.DEV === "true";
const cookieSecure = process.env.COOKIE_SECURE === "true";
const clientDist = path.join(__dirname, "..", "client", "dist");
const hasClient = fs.existsSync(path.join(clientDist, "index.html"));

const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /localhost:\d+$/.test(origin) || /^http:\/\/192\.168\./.test(origin)) {
        return callback(null, true);
      }
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    rolling: true,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: cookieSecure,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    store: MongoStore.create({ mongoUrl: mongoSessionUri || mongoUri }),
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    db: "project-captainjohn",
    mode: isDev ? "development" : "production",
    client: hasClient ? "served" : "missing",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (hasClient) {
  app.use(
    history({
      rewrites: [
        { from: /^\/api\/.*$/, to: (context) => context.parsedUrl.path },
        { from: /^\/uploads\/.*$/, to: (context) => context.parsedUrl.path },
      ],
    })
  );
  app.use(express.static(clientDist, { index: "index.html" }));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return res.status(404).json({ error: "Niet gevonden" });
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  console.error("Client-build ontbreekt in client/dist. Draai: npm run build");
  process.exit(1);
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Serverfout" });
});

app.listen(PORT, "0.0.0.0", () => {
  connect();
  console.log(`Captain John op http://localhost:${PORT} (API + client)`);
});

async function migrateLegacyPhotos() {
  const projects = await Project.find({
    photos: { $elemMatch: { fileId: { $exists: false }, filename: { $exists: true } } },
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
