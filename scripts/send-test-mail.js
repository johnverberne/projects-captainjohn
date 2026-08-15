require("../server/loadEnv");
const { sendMail, smtpConfigured } = require("../server/services/mail");

(async () => {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    console.error("ADMIN_EMAIL ontbreekt");
    process.exit(1);
  }
  if (!smtpConfigured()) {
    console.error("SMTP is niet geconfigureerd (SMTP_HOST/USER/PASS)");
    process.exit(1);
  }

  const info = await sendMail(
    to,
    "Captain John — SMTP test",
    "<p>Dit is een <strong>testbericht</strong> vanaf Captain John.</p><p>Als je deze mail ontvangt, werkt SMTP.</p>"
  );
  console.log(`Verstuurd naar ${to} (messageId: ${info.messageId})`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
