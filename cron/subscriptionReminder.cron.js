const cron = require("node-cron");
const Subscription = require("../models/subscription");
const Payment = require("../models/payment");
const notify = require("../utils/subscriptionNotifier");

const { getSubscriptionStatus, GRACE_DAYS } = require("../utils/subscriptionStatusHelper");

// Helper to strip time for accurate date comparison
const getZeroTime = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Delay helper to prevent hitting email rate limits
const razorpay = require("../services/razorpayClient");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

cron.schedule("0 10 * * *", async () => {
  console.log("Running subscription reminder cron...");
  const now = new Date();
  const todayZero = getZeroTime(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const subs = await Subscription.find({
      status: { $in: ["active", "created", "past_due"] },
      nextChargeAt: { $exists: true },
    })
      .populate("userId", "email phone name")
      .populate("orderInternalId", "paymentStatus");

    console.log(`Found ${subs.length} subscriptions to check.`);

    for (const sub of subs) {
      // Wrap each user in try/catch so one failure doesn't stop the whole batch
      try {
        if (!sub.userId || !sub.userId.email) continue;

        // 🔄 Optimized Billing Cycle Logic: Handles February & Leap Years
        const nextChargeAt = new Date(sub.nextChargeAt);
        const dueZero = getZeroTime(nextChargeAt);

        // 🔄 Optimized Paid Check: Has user paid for THIS specific cycle?
        // If they have a payment on or after the day they were due, they are good.
        const hasPaid = sub.lastPaymentAt && getZeroTime(sub.lastPaymentAt) >= dueZero;

        if (hasPaid) {
          // Reset flags if they were set but payment just cleared
          if (sub.notifiedDue || sub.notifiedGrace || sub.notifiedStrict) {
            sub.notifiedDue = false;
            sub.notifiedGrace = false;
            sub.notifiedStrict = false;
            await sub.save();
          }
          continue;
        }

        // 🏁 RE-ARM notifications if we are in a NEW cycle
        // If today has reached or passed the Due Date, and these are still TRUE from 
        // the PREVIOUS month, we must reset them to allow ONE message for the NEW month.
        if (todayZero >= dueZero) {
          const lastNotified = sub.lastNotifiedCycle ? new Date(sub.lastNotifiedCycle) : null;
          // If we haven't notified for THIS specific nextChargeAt yet, reset the flags
          if (!lastNotified || getZeroTime(lastNotified).getTime() !== dueZero.getTime()) {
            sub.notifiedDue = false;
            sub.notifiedGrace = false;
            sub.notifiedStrict = false;
            sub.oneTimePaymentLink = null; // 🛡️ Force fresh link for NEW cycle
            sub.oneTimePaymentLinkId = null;
            sub.lastNotifiedCycle = dueZero; // Mark that we are now working on this cycle
            await sub.save();
          }
        }

        const graceUntil = new Date(dueZero);
        graceUntil.setDate(dueZero.getDate() + GRACE_DAYS);

        const currentStatus = getSubscriptionStatus(sub.nextChargeAt, null);
        let notificationType = null;
        if (currentStatus === 'Overdue' && !sub.notifiedStrict) notificationType = 'STRICT';
        else if (currentStatus === 'In Grace' && todayZero.getTime() === graceUntil.getTime() && !sub.notifiedGrace) notificationType = 'GRACE';
        else if (currentStatus === 'Due Today' && !sub.notifiedDue) notificationType = 'DUE';

        let notificationSent = false;

        if (notificationType === 'STRICT') {
          // 🛡️ GENERATE FALLBACK LINK IF MISSING
          if (!sub.oneTimePaymentLink) {
            try {
              const plink = await razorpay.paymentLink.create({
                amount: sub.planAmount,
                currency: sub.currency || "INR",
                accept_partial: false,
                description: `URGENT: Monthly payment for Subscription ${sub.subscriptionId}`,
                customer: {
                    name: sub.userId?.name || "Customer",
                    email: sub.userId?.email || "no-email@rentbuddy.in",
                    contact: sub.userId?.phone,
                },
                notes: {
                    subscriptionId: sub.subscriptionId,
                    orderId: sub.orderId,
                    orderInternalId: sub.orderInternalId?._id?.toString() || sub.orderInternalId?.toString(),
                    type: "cron_fallback_generation_strict",
                },
              });
              sub.oneTimePaymentLink = plink.short_url;
              sub.oneTimePaymentLinkId = plink.id;
              await sub.save();
            } catch (plErr) {
              console.error(`[Cron-Strict] Link generation failed for ${sub._id}:`, plErr.message);
            }
          }

          await notify(sub, sub.userId, "STRICT", sub.nextChargeAt);
          sub.notifiedStrict = true;
          sub.notifiedGrace = true; 
          sub.notifiedDue = true;
          if (sub.lastPaymentAt || (sub.orderInternalId && sub.orderInternalId.paymentStatus === "Paid")) {
            sub.status = "past_due";
          }
          notificationSent = true;
        }
        else if (notificationType === 'GRACE') {
          // 🛡️ GENERATE FALLBACK LINK IF MISSING
          if (!sub.oneTimePaymentLink) {
            try {
              const plink = await razorpay.paymentLink.create({
                amount: sub.planAmount,
                currency: sub.currency || "INR",
                accept_partial: false,
                description: `Monthly payment (Grace Period) for Subscription ${sub.subscriptionId}`,
                customer: {
                    name: sub.userId?.name || "Customer",
                    email: sub.userId?.email || "no-email@rentbuddy.in",
                    contact: sub.userId?.phone,
                },
                notes: {
                    subscriptionId: sub.subscriptionId,
                    orderId: sub.orderId,
                    orderInternalId: sub.orderInternalId?._id?.toString() || sub.orderInternalId?.toString(),
                    type: "cron_fallback_generation_grace",
                },
              });
              sub.oneTimePaymentLink = plink.short_url;
              sub.oneTimePaymentLinkId = plink.id;
              await sub.save();
            } catch (plErr) {
              console.error(`[Cron-Grace] Link generation failed for ${sub._id}:`, plErr.message);
            }
          }

          await notify(sub, sub.userId, "GRACE", sub.nextChargeAt);
          sub.notifiedGrace = true;
          sub.notifiedDue = true;
          notificationSent = true;
        }
        else if (notificationType === 'DUE') {
          // 🛡️ GENERATE FALLBACK LINK IF MISSING
          if (!sub.oneTimePaymentLink) {
            try {
              const plink = await razorpay.paymentLink.create({
                amount: sub.planAmount,
                currency: sub.currency || "INR",
                accept_partial: false,
                description: `Monthly payment for Subscription ${sub.subscriptionId}`,
                customer: {
                    name: sub.userId?.name || "Customer",
                    email: sub.userId?.email || "no-email@rentbuddy.in",
                    contact: sub.userId?.phone,
                },
                notes: {
                    subscriptionId: sub.subscriptionId,
                    orderId: sub.orderId,
                    orderInternalId: sub.orderInternalId?._id?.toString() || sub.orderInternalId?.toString(),
                    type: "cron_fallback_generation",
                },
              });
              sub.oneTimePaymentLink = plink.short_url;
              sub.oneTimePaymentLinkId = plink.id;
              await sub.save();
            } catch (plErr) {
              console.error(`[Cron] Fallback link generation failed for sub ${sub._id}:`, plErr.message);
            }
          }

          await notify(sub, sub.userId, "DUE", sub.nextChargeAt);
          sub.notifiedDue = true;
          notificationSent = true;
        }

        if (notificationSent) {
          await sub.save();
          // Wait 2 seconds between emails to be safe with Gmail limits
          await wait(2000);
        }

      } catch (err) {
        console.error(`Error processing sub ${sub._id} for user ${sub.userId?.email}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Fatal error in subscription cron:", err);
  }
});
