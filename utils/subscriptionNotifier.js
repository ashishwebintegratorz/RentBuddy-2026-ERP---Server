const { sendWhatsAppCampaign } = require("../services/aisensy.service");
const sendEmail = require("../services/email.service");
const { getTemplate } = require("./emailTemplates");

const Rental = require("../models/rentalProducts");

module.exports = async function notify(sub, user, type, data) {
  // 🛡️ GLOBAL PRODUCT GUARD: Prevent reminders if no active rentals exist
  if (["DUE", "PRE_DUE", "GRACE", "GRACE_FINAL", "STRICT"].includes(type)) {
     const activeRentals = await Rental.find({
       $or: [
         { subscriptionId: sub.subscriptionId }, 
         { orderId: sub.orderInternalId?._id || sub.orderInternalId }
       ].filter(Boolean),
       rentalStatus: 'active'
     });
     
     if (activeRentals.length === 0) {
       console.log(`[Notifier] Safeguard triggered. Skipping ${type} for sub ${sub.subscriptionId} (No active rentals).`);
       return;
     }
  }

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
      subject = "Payment Pending – Grace Period Started";
      message = `⚠️ PAYMENT REMINDER

Your Rentbuddy subscription payment is still pending.

Your subscription is now in a grace period. Please complete payment within the next few days to avoid service interruption.

💰 Amount: ₹${sub.planAmount / 100}

Please complete payment:
${payLink}

— Rentbuddy Team`;
      break;

    case "GRACE_FINAL":
      subject = "Final Notice: Payment Grace Period Ending Today";
      message = `⚠️ FINAL PAYMENT REMINDER

This is your final notice. Your Rentbuddy subscription grace period ends TODAY.
To avoid service interruption, please complete your payment immediately.

💰 Amount: ₹${sub.planAmount / 100}

Pay now:
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

  // --- AI Sensy WhatsApp Notification ---
  const campaignName = process.env.AISENSY_REMINDER_CAMPAIGN_NAME;
  const amountStr = (sub.planAmount / 100).toString();
  
  // Format date as DD-MM-YYYY to match the user's template
  const rawDate = data instanceof Date ? data : new Date(data || Date.now());
  const dueDateStr = `${String(rawDate.getDate()).padStart(2, '0')}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${rawDate.getFullYear()}`;

  // Template Params: {{1}}=Name, {{2}}=Amount, {{3}}=DueDate, {{4}}=Link
  // Note: Only sending for reminders, not for MANUAL_SKIP unless a template exists
  if (["DUE", "PRE_DUE", "GRACE", "GRACE_FINAL", "STRICT"].includes(type)) {
    try {
      if (campaignName && user.phone) {
        await sendWhatsAppCampaign(user.phone, campaignName, [user.name || "Customer", amountStr, dueDateStr, payLink], user.name);
      } else {
        console.warn(`[Notifier] Missing AISENSY_REMINDER_CAMPAIGN_NAME or user phone. Skipping WhatsApp.`);
      }
    } catch (err) {
      console.error(`WhatsApp notification failed for ${user.phone}:`, err.message);
    }
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
