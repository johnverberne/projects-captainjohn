const express = require("express");
const argon2 = require("argon2");
const niceware = require("niceware");
const User = require("../model/user.model");
const { sendMail, smtpConfigured } = require("../services/mail");

const router = express.Router();
const isDev = process.env.DEV === "true";
const adminEmail = process.env.ADMIN_EMAIL || "john.verberne@gmail.com";
const createSecret =
  process.env.CREATE_SECRET || process.env.SESSION_SECRET || "captainjohn-create";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function getCurrentHost(request) {
  return `${request.protocol}://${request.get("host")}`;
}

async function generatePassword() {
  const pass = niceware.generatePassphrase(8)[0];
  const hash = await argon2.hash(pass);
  return { pass, hash };
}

async function deliverOrLog(to, subject, html, logLabel) {
  if (smtpConfigured()) {
    return sendMail(to, subject, html);
  }
  console.log(`[${logLabel}] SMTP ontbreekt — mail naar ${to}`);
  console.log(subject);
  console.log(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
  return { messageId: "local-log" };
}

router.get("/me", async (req, res) => {
  try {
    if (!req.session?.email) {
      return res.json({ login: false, user: null });
    }
    const user = await User.findOne({ email: req.session.email }).select("-pw").lean();
    if (!user || user.active === false) {
      req.session.destroy(() => undefined);
      return res.json({ login: false, user: null });
    }
    res.json({ login: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toegangsaanvraag zonder zelfgekozen wachtwoord
router.post("/create-login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const reason = String(req.body.reason || "").trim();
    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Naam is verplicht" });
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Geldig e-mailadres is verplicht" });
    }
    if (!reason) {
      return res.status(400).json({ error: "Reden is verplicht" });
    }
    if (!adminEmail) {
      return res.status(500).json({ error: "ADMIN_EMAIL is niet geconfigureerd" });
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(401).json({ error: "Dit e-mailadres is al geregistreerd" });
    }

    const host = getCurrentHost(req);
    const approveUrl =
      `${host}/api/auth/create-confirm?email=${encodeURIComponent(email)}` +
      `&name=${encodeURIComponent(name)}` +
      `&secret=${encodeURIComponent(createSecret)}`;
    const denyUrl = `${host}/api/auth/create-denied?email=${encodeURIComponent(email)}&secret=${encodeURIComponent(createSecret)}`;

    await deliverOrLog(
      adminEmail,
      "Captain John — nieuwe gebruiker aanvraag",
      "Er is een nieuwe gebruiker aangevraagd voor Captain John.<br/><br/>" +
        `Naam: <span style="color:#8f4024">${name}</span><br/><br/>` +
        `E-mail: <span style="color:#8f4024">${email}</span><br/><br/>` +
        `Reden: <span style="color:#8f4024">${reason}</span><br/><br/>` +
        `<a href="${approveUrl}">Aanvraag goedkeuren</a><br/><br/>` +
        `<a href="${denyUrl}">Aanvraag afwijzen</a><br/><br/>` +
        `Verzoek komt van [${req.hostname}]`,
      "create-login"
    );

    res.json({ create: true, msg: "Aanvraag ontvangen" });
  } catch (error) {
    console.error("create-login error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin keurt goed → account + gegenereerd argon2-wachtwoord per mail
router.get("/create-confirm", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    const name = String(req.query.name || "").trim() || email.split("@")[0];
    const secret = String(req.query.secret || "");
    if (secret !== createSecret) {
      return res.status(401).send("Ongeldige of verlopen link");
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(200)
        .send(
          "<html lang='nl'><body><h1>Gebruiker bestaat al</h1><p>Dit account staat al in de database.</p></body></html>"
        );
    }

    const { pass, hash } = await generatePassword();
    await User.create({
      email,
      name,
      pw: hash,
      roles: ["editor"],
      loginCount: 0,
      lastLogin: "",
      active: true,
    });

    await deliverOrLog(
      email,
      "Captain John — uw nieuwe account",
      `Beste ${name},<br/><br/>` +
        "Er is een account voor u aangemaakt bij Captain John atelierprojecten.<br/><br/>" +
        `E-mail: <span style="color:#8f4024">${email}</span><br/><br/>` +
        `Uw wachtwoord is:<br/><span style="color:#8f4024;font-weight:700">${pass}</span><br/><br/>` +
        "U kunt dit wachtwoord gebruiken of later via de website resetten.<br/><br/>" +
        "Captain John",
      "create-confirm"
    );

    res
      .status(200)
      .send(
        "<html lang='nl'><body><h1>Gebruiker aangemaakt</h1><p>Een e-mail met wachtwoord is verstuurd naar de gebruiker.</p></body></html>"
      );
  } catch (error) {
    console.error("create-confirm error:", error);
    res.status(500).send("Er ging iets mis bij het aanmaken van de gebruiker");
  }
});

router.get("/create-denied", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    const secret = String(req.query.secret || "");
    if (secret !== createSecret) {
      return res.status(401).send("Ongeldige of verlopen link");
    }

    await deliverOrLog(
      email,
      "Captain John — accountaanvraag",
      "Er is een account aangevraagd bij Captain John atelierprojecten.<br/><br/>" +
        `E-mail: <span style="color:#8f4024">${email}</span><br/><br/>` +
        "Helaas kunnen we op dit moment geen toegang geven.<br/>" +
        "U staat op de wachtlijst; we nemen contact op als er plek is.<br/><br/>" +
        "Captain John",
      "create-denied"
    );

    res
      .status(200)
      .send(
        "<html lang='nl'><body><h1>Aanvraag afgewezen</h1><p>Een e-mail is verstuurd naar de gebruiker.</p></body></html>"
      );
  } catch (error) {
    console.error("create-denied error:", error);
    res.status(500).send("Er ging iets mis");
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const pw = req.body.pw || req.body.password;

    const user = await User.findOne({ email }).lean();
    if (!user || user.active === false || !(await argon2.verify(user.pw, String(pw || "")))) {
      return res.status(401).json({ login: false, error: "Ongeldige login" });
    }

    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      {
        $inc: { loginCount: 1 },
        $set: { lastLogin: String(Date.now()) },
      },
      { new: true }
    ).select("-pw");

    req.session.email = user.email;
    req.session.roles = user.roles || [];
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    res.json({ login: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/logout", async (req, res) => {
  try {
    if (!req.session) {
      return res.json({ logout: true, login: false });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.clearCookie("connect.sid");
      res.json({ logout: true, login: false });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/reset-login", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Geldig e-mailadres is verplicht" });
    }

    const user = await User.findOne({ email });
    if (!user || user.active === false) {
      return res.status(401).json({ error: "Onbekend e-mailadres" });
    }

    const { pass, hash } = await generatePassword();
    user.pw = hash;
    await user.save();

    const subject = "Captain John — wachtwoord reset";
    const message =
      "Er is een wachtwoord reset aangevraagd voor Captain John atelierprojecten.<br/><br/>" +
      "Uw nieuwe wachtwoord is:<br/>" +
      `<span style="color:#8f4024;font-weight:700">${pass}</span><br/><br/>` +
      "Captain John";

    if (smtpConfigured()) {
      const info = await sendMail(email, subject, message);
      return res.json({ message: "Email sent", messageId: info.messageId });
    }

    console.log(`[reset-login] Nieuw wachtwoord voor ${email}: ${pass}`);
    const payload = {
      message: "Email sent",
      note: "SMTP niet geconfigureerd — wachtwoord staat in de serverlog",
    };
    if (isDev || process.env.COOKIE_SECURE !== "true") {
      payload.devPassword = pass;
    }
    return res.json(payload);
  } catch (error) {
    console.error("reset-login error:", error);
    res.status(500).json({
      error: "Er ging iets mis bij het resetten van het wachtwoord",
    });
  }
});

module.exports = router;
