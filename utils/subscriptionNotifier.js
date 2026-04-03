const sendWhatsApp = require("../services/whatsapp.service");
const sendEmail = require("../services/email.service");
const { getTemplate } = require("./emailTemplates");

module.exports = async function notify(sub, user, type, data) {
  const payLink = sub.oneTimePaymentLink || sub.shortUrl || "https://rentbuddy.in/pay";

  let subject = "";
  let message = "";

  switch (type) {
    case "DUE":
      subject = "Subscription Payment Due";
      message = `Hello ${user.name || ""},

Your monthly Rentbuddy subscription payment is due today.

💰 Amount: ₹${sub.planAmount / 100}
📅 Due Date: Today

Pay now to avoid late issues:
${payLink}

— Rentbuddy Team`;
      break;

    case "PRE_DUE":
      subject = "Upcoming Payment Reminder - 2 Days to go";
      message = `Hello ${user.name || ""},

This is a friendly reminder that your monthly Rentbuddy subscription payment will be due in 2 days.

💰 Amount: ₹${sub.planAmount / 100}
📅 Due Date: ${(data instanceof Date ? data : new Date(data)).toLocaleDateString("en-IN")}

Please ensure your account has sufficient balance for auto-debit or pay manually:
${payLink}

— Rentbuddy Team`;
      break;

    case "GRACE":
      subject = "Payment Pending – Grace Period";
      message = `⚠️ PAYMENT REMINDER

Your Rentbuddy subscription payment is still pending.

⏳ Grace period ends today.
💰 Amount: ₹${sub.planAmount / 100}

Please complete payment immediately:
${payLink}

— Rentbuddy Team`;
      break;

    case "STRICT":
      subject = "Payment Overdue – Immediate Action Required";
      message = `🚨 PAYMENT OVERDUE

Your subscription payment is overdue beyond the grace period.
This is not acceptable.

💰 Amount Due: ₹${sub.planAmount / 100}

Immediate payment required to continue service:
${payLink}

— Rentbuddy Compliance Team`;
      break;

    case "MANUAL_SKIP":
      subject = "Payment Marked as Manual – Subscription Active";
      message = `Hello,

Your subscription payment for this month has been manually adjusted by Rentbuddy Admin.

✔ Subscription remains active
✔ No action required from your side

Thank you for being with Rentbuddy.`;
      break;
  }

  try {
    await sendWhatsApp(user.phone, message);
  } catch (err) {
    console.error(`WhatsApp notification failed for ${user.phone}:`, err.message);
  }

  const emailHtml = getTemplate(type, {
    name: user.name,
    amount: sub.planAmount,
    dueDate: (data instanceof Date ? data : new Date(data || Date.now())).toLocaleDateString("en-IN"),
    payLink: payLink,
    status: type
  });

  await sendEmail(user.email, subject, message, emailHtml);
  console.log("Notification sent:", { to: user.email || user.phone, subject });
};
