const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

module.exports = async function sendEmail(to, subject, text, html) {
  if (!to) return;

  try {
    await transporter.sendMail({
      from: `"Billing Team" <${process.env.MAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"), // Fallback if html not provided
    });
  } catch (err) {
    console.error(`Email send failed to ${to}:`, err.message);
    // We don't throw here to avoid crashing the caller (e.g., a loop)
  }
};
