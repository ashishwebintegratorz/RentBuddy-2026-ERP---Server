const mongoose = require("mongoose");
const razorpay = require("../services/razorpayClient");
const Subscription = require("../models/subscription");
const User = require("../models/auth");
const notify = require("../utils/subscriptionNotifier");
require("dotenv").config();

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected.");

    const now = new Date();
    const subs = await Subscription.find({}).populate("userId");

    console.log(`Analyzing ${subs.length} total subscriptions...`);

    let sentCount = 0;

    for (const sub of subs) {
      if (!sub.userId) {
        continue;
      }

      const nextCharge = sub.nextChargeAt ? new Date(sub.nextChargeAt) : null;
      
      // Strict filter: Status is past_due OR (Active but nextChargeAt is in the past)
      const isOverdue = sub.status === "past_due" || (nextCharge && nextCharge < now);

      if (isOverdue) {
        // Double check payment for current cycle
        const cycleStart = nextCharge ? new Date(nextCharge) : new Date();
        cycleStart.setMonth(cycleStart.getMonth() - 1);
        const hasPaid = sub.lastPaymentAt && sub.lastPaymentAt >= cycleStart;

        if (hasPaid) {
            continue;
        }

        console.log(`Processing overdue sub ${sub.subscriptionId} for user ${sub.userId.email}...`);

        // Generate fallback link if missing
        if (!sub.oneTimePaymentLink) {
          try {
            console.log("Generating missing fallback link...");
            const plink = await razorpay.paymentLink.create({
              amount: sub.planAmount,
              currency: sub.currency || "INR",
              accept_partial: false,
              description: `Monthly payment for Subscription ${sub.subscriptionId}`,
              customer: {
                name: sub.userId.name || "Customer",
                email: sub.userId.email || "no-email@rentbuddy.in",
                contact: sub.userId.phone,
              },
              notes: {
                subscriptionId: sub.subscriptionId,
                orderId: sub.orderId,
                orderInternalId: sub.orderInternalId?._id?.toString() || sub.orderInternalId?.toString(),
                type: "manual_bulk_fix",
              },
            });
            sub.oneTimePaymentLink = plink.short_url;
            sub.oneTimePaymentLinkId = plink.id;
            await sub.save();
          } catch (plErr) {
            console.error(`Link generation failed for ${sub.subscriptionId}:`, plErr.message);
            continue;
          }
        }

        // Send notification
        try {
          const nType = sub.status === "past_due" ? "STRICT" : "DUE";
          await notify(sub, sub.userId, nType, sub.nextChargeAt);
          sentCount++;
          console.log(`Notification sent to ${sub.userId.email}`);
        } catch (notifErr) {
          console.error(`Notification failed for ${sub.userId.email}:`, notifErr.message);
        }

        // Small delay
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`Done. Successfully sent ${sentCount} notifications.`);
    process.exit(0);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

run();
