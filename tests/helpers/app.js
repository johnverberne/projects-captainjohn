require("./env");
const { createApp } = require("../../server/createApp");
const { connectTestDb } = require("./db");

let app;

async function getTestApp() {
  await connectTestDb();
  if (!app) {
    app = createApp({
      allowNoClient: true,
      mongoUri: process.env.MONGO_URI,
      mongoSessionUri: process.env.MONGO_URI,
      sessionSecret: process.env.SESSION_SECRET,
    });
  }
  return app;
}

module.exports = { getTestApp };
