const cron = require("node-cron");
const Subscription = require("../models/subscription");
const Payment = require("../models/payment");
const notify = require("../utils/subscriptionNotifier");

const { getSubscriptionStatus, GRACE_DAYS } = require("../utils/subscriptionStatusHelper");
const Rental = require("../models/rentalProducts");

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
        // Match by forMonth (first of month) AND specific IDs to avoid collision between multiple subs/orders
        const cycleMonth = new Date(dueZero.getFullYear(), dueZero.getMonth(), 1);
        const paymentRecord = await Payment.findOne({
          $or: [
            { razorpaySubscriptionId: sub.subscriptionId },
            { orderId: sub.orderId }
          ],
          paymentStatus: "Success",
          forMonth: cycleMonth
        });

        const hasPaidCurrentCycle = paymentRecord || (sub.lastPaymentAt && getZeroTime(sub.lastPaymentAt).getTime() >= dueZero.getTime());

        if (hasPaidCurrentCycle) {
          // Reset flags if payment cleared for this cycle
          if (sub.notifiedDue || sub.notifiedGrace || sub.notifiedGraceFinal || sub.notifiedStrict || sub.notifiedTwoDaysBefore) {
            sub.notifiedDue = false;
            sub.notifiedGrace = false;
            sub.notifiedGraceFinal = false;
            sub.notifiedStrict = false;
            sub.notifiedTwoDaysBefore = false;
            await sub.save();
          }
          continue;
        }

        // 🛡️ PRODUCT GUARD: Only send reminders if there is actually an active rental product
        const activeRentals = await Rental.find({
          $or: [
            { subscriptionId: sub.subscriptionId }, 
            { orderId: sub.orderInternalId?._id || sub.orderInternalId }
          ].filter(Boolean),
          rentalStatus: 'active'
        });

        if (activeRentals.length === 0) {
           console.log(`[Cron] Skipping sub ${sub.subscriptionId} - No active rentals found.`);
           continue;
        }

        // 🏁 RE-ARM notifications and RESET links if we have transitioned to a NEW cycle
        const lastNotified = sub.lastNotifiedCycle ? new Date(sub.lastNotifiedCycle) : null;
        if (!lastNotified || getZeroTime(lastNotified).getTime() !== dueZero.getTime()) {
           sub.notifiedDue = false;
           sub.notifiedGrace = false;
           sub.notifiedGraceFinal = false;
           sub.notifiedStrict = false;
           sub.notifiedTwoDaysBefore = false;
           
           // CRITICAL: Reset the payment link when moving to a new cycle 
           // This prevents reusing the 'initial setup' link which includes security deposits.
           sub.oneTimePaymentLink = null;
           sub.oneTimePaymentLinkId = null;
           sub.lastNotifiedCycle = dueZero;
           await sub.save();
           console.log(`[Cron] Cycle reset for sub ${sub.subscriptionId} to ${dueZero.toDateString()}`);
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
            // Day 1 of grace
            if (todayZero.getTime() === graceStart.getTime() && !sub.notifiedGrace) {
                notificationType = 'GRACE';
            }
            // Last day of grace
            else if (todayZero.getTime() === graceUntil.getTime() && !sub.notifiedGraceFinal) {
                notificationType = 'GRACE_FINAL';
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
          if (notificationType === 'GRACE_FINAL') {
              sub.notifiedGraceFinal = true;
              sub.notifiedGrace = true;
          }
          if (notificationType === 'STRICT') {
              sub.notifiedStrict = true;
              sub.notifiedGraceFinal = true;
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
