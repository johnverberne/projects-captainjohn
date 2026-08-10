const nodemailer = require("nodemailer");

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

/** Zelfde mail-setup als bdeditor/server/api/User.js sendMail */
async function sendMail(to, subject, message) {
  if (!smtpConfigured()) {
    const err = new Error("SMTP is niet geconfigureerd");
    err.code = "SMTP_MISSING";
    throw err;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE, // false for TLS (587), true for SSL (465)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to,
    subject,
    html: message,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("Email sent:", info.messageId + " to: " + to);
  return info;
}

module.exports = { sendMail, smtpConfigured };
