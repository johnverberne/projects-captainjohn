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
const firingSchemasRouter = require("./api/firingSchemas");
const authRouter = require("./api/auth");
const apiDocsRouter = require("./api/apiDocs");

function createApp(options = {}) {
  const mongoUri = options.mongoUri || process.env.MONGO_URI;
  const mongoSessionUri =
    options.mongoSessionUri || process.env.MONGO_SESSION_URI || mongoUri;
  const sessionSecret =
    options.sessionSecret || process.env.SESSION_SECRET || "captainjohn-dev";
  const isDev = process.env.DEV === "true";
  const cookieSecure = process.env.COOKIE_SECURE === "true";
  const clientDist = path.join(__dirname, "..", "client", "dist");
  const hasClient = fs.existsSync(path.join(clientDist, "index.html"));
  const allowNoClient =
    options.allowNoClient === true ||
    process.env.ALLOW_NO_CLIENT === "true";

  if (!hasClient && !allowNoClient) {
    throw new Error(
      "Client-build ontbreekt in client/dist. Draai: npm run build"
    );
  }

  if (!mongoSessionUri) {
    throw new Error(
      "MONGO_URI ontbreekt. Kopieer .env.example naar .env en vul de MongoDB-verbinding in."
    );
  }

  const app = express();
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          /localhost:\d+$/.test(origin) ||
          /^http:\/\/192\.168\./.test(origin)
        ) {
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
      store: MongoStore.create({ mongoUrl: mongoSessionUri }),
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

  app.use("/api", apiDocsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/firing-schemas", firingSchemasRouter);
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));
  app.use(
    "/fonts",
    express.static(path.join(__dirname, "..", "client", "src", "fonts"))
  );

  if (hasClient) {
    app.use(
      history({
        rewrites: [
          { from: /^\/api\/.*$/, to: (context) => context.parsedUrl.path },
          { from: /^\/uploads\/.*$/, to: (context) => context.parsedUrl.path },
          { from: /^\/fonts\/.*$/, to: (context) => context.parsedUrl.path },
        ],
      })
    );
    app.use(express.static(clientDist, { index: "index.html" }));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/fonts")) {
        return res.status(404).json({ error: "Niet gevonden" });
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(400).json({ error: err.message || "Serverfout" });
  });

  return app;
}

module.exports = { createApp };
