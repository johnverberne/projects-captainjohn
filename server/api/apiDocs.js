const express = require("express");
const {
  ENDPOINTS,
  wantsJson,
  renderApiDocsHtml,
} = require("./endpointCatalog");

const router = express.Router();

router.get(["/", ""], (req, res) => {
  if (!req.session?.email) {
    if (wantsJson(req)) {
      return res.status(401).json({ error: "Session expired" });
    }
    return res.redirect("/inloggen?return=/api");
  }

  if (wantsJson(req)) {
    return res.json({
      ok: true,
      user: req.session.email,
      groups: ENDPOINTS,
    });
  }

  res.type("html").send(
    renderApiDocsHtml({
      email: req.session.email,
      groups: ENDPOINTS,
    })
  );
});

module.exports = router;
