const nodemailer = require("nodemailer");

module.exports = async function sendEmail({ to, subject, html }) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Alarm Bot" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✉️  Mail accepted by Gmail. Message-Id:", info.messageId);
    return true;
  } catch (err) {
    console.error("✉️  Mail send failed:", err);
    throw err;
  }
};
