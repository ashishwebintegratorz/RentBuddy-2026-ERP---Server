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

  try {
    const subs = await Subscription.find({
      status: { $in: ["active", "created", "past_due"] },
      nextChargeAt: { $exists: true },
    })
      .populate("userId", "email phone name")
      .populate("orderInternalId", "paymentStatus");

    console.log(`Found ${subs.length} subscriptions to check.`);

    for (const sub of subs) {
      try {
        if (!sub.userId || !sub.userId.email) continue;

        const nextChargeAt = new Date(sub.nextChargeAt);
        const dueZero = getZeroTime(nextChargeAt);

        // 🔄 ROBUST PAID CHECK: Has the user paid for THIS specific cycle?
        // Check for a Payment record where forMonth matches nextChargeAt's month bucket
        const cycleMonth = new Date(dueZero.getFullYear(), dueZero.getMonth(), 1);
        const paymentRecord = await Payment.findOne({
          userId: sub.userId._id,
          paymentStatus: "Success",
          forMonth: cycleMonth
        });

        const hasPaidCurrentCycle = paymentRecord || (sub.lastPaymentAt && getZeroTime(sub.lastPaymentAt).getTime() >= dueZero.getTime());

        if (hasPaidCurrentCycle) {
          // Reset flags if payment cleared for this cycle
          if (sub.notifiedDue || sub.notifiedGrace || sub.notifiedStrict || sub.notifiedTwoDaysBefore) {
            sub.notifiedDue = false;
            sub.notifiedGrace = false;
            sub.notifiedStrict = false;
            sub.notifiedTwoDaysBefore = false;
            await sub.save();
          }
          continue;
        }

        // 🏁 RE-ARM notifications if we have transitioned to a NEW cycle
        const lastNotified = sub.lastNotifiedCycle ? new Date(sub.lastNotifiedCycle) : null;
        if (lastNotified && getZeroTime(lastNotified).getTime() !== dueZero.getTime()) {
           sub.notifiedDue = false;
           sub.notifiedGrace = false;
           sub.notifiedStrict = false;
           sub.notifiedTwoDaysBefore = false;
           sub.oneTimePaymentLink = null;
           sub.oneTimePaymentLinkId = null;
           sub.lastNotifiedCycle = dueZero;
           await sub.save();
        }

        const graceUntil = new Date(dueZero);
        graceUntil.setDate(dueZero.getDate() + GRACE_DAYS);
        const graceStart = new Date(dueZero);
        graceStart.setDate(dueZero.getDate() + 1);

        const currentStatus = getSubscriptionStatus(sub.nextChargeAt, null);
        let notificationType = null;

        // 🚨 2-DAY BEFORE REMINDER
        const twoDaysBefore = new Date(dueZero);
        twoDaysBefore.setDate(dueZero.getDate() - 2);

        if (todayZero.getTime() === twoDaysBefore.getTime() && !sub.notifiedTwoDaysBefore) {
            notificationType = 'PRE_DUE';
        }
        else if (currentStatus === 'Due Today' && !sub.notifiedDue) {
            notificationType = 'DUE';
        }
        else if (currentStatus === 'In Grace') {
            // Notify on first day of grace OR last day of grace
            if ((todayZero.getTime() === graceStart.getTime() || todayZero.getTime() === graceUntil.getTime()) && !sub.notifiedGrace) {
                notificationType = 'GRACE';
            }
            // Update status to reflect late payment
            if (sub.status !== 'past_due') {
                sub.status = 'past_due';
                await sub.save();
            }
        }
        else if (currentStatus === 'Overdue' && !sub.notifiedStrict) {
            notificationType = 'STRICT';
        }

        if (notificationType) {
          // Generate Link if missing
          if (!sub.oneTimePaymentLink) {
            try {
              const plink = await razorpay.paymentLink.create({
                amount: sub.planAmount,
                currency: sub.currency || "INR",
                accept_partial: false,
                description: `Payment for Subscription ${sub.subscriptionId} (${notificationType})`,
                customer: {
                    name: sub.userId?.name || "Customer",
                    email: sub.userId?.email || "no-email@rentbuddy.in",
                    contact: sub.userId?.phone,
                },
                notes: {
                    subscriptionId: sub.subscriptionId,
                    orderId: sub.orderId,
                    type: "cron_reminder_" + notificationType.toLowerCase(),
                },
              });
              sub.oneTimePaymentLink = plink.short_url;
              sub.oneTimePaymentLinkId = plink.id;
            } catch (plErr) {
              console.error(`[Cron] Link fail for sub ${sub._id}:`, plErr.message);
            }
          }

          // Trigger Notification
          await notify(sub, sub.userId, notificationType, sub.nextChargeAt);

          // Mark Flags
          if (notificationType === 'PRE_DUE') sub.notifiedTwoDaysBefore = true;
          if (notificationType === 'DUE') sub.notifiedDue = true;
          if (notificationType === 'GRACE') sub.notifiedGrace = true;
          if (notificationType === 'STRICT') {
              sub.notifiedStrict = true;
              sub.notifiedGrace = true;
              sub.notifiedDue = true;
          }

          await sub.save();
          console.log(`[Cron] Notification sent: ${notificationType} to ${sub.userId.email}`);
          await wait(2000);
        }

      } catch (err) {
        console.error(`Error processing sub ${sub._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Fatal error in subscription cron:", err);
  }
});
