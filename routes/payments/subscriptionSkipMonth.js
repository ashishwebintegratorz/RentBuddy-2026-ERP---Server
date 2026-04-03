const express = require("express");
const router = express.Router();

const Subscription = require("../../models/subscription");
const Payment = require("../../models/payment");
const Order = require("../../models/orders");
const Rental = require("../../models/rentalProducts");
const verifyToken = require("../../middlewares/verifyToken");
const notify = require("../../utils/subscriptionNotifier");

// Helper function to add months safely
function addMonthsSafely(date, months) {
  const result = new Date(date);
  const expectedMonth = (result.getMonth() + months) % 12;
  result.setMonth(result.getMonth() + months);
  if (result.getMonth() !== expectedMonth) {
    result.setDate(0);
  }
  return result;
}

/**
 * ADMIN: Skip current month (manual payment)
 * - Does NOT cancel subscription
 * - Records manual payment
 * - Resets grace / strict flags
 * - Notifies customer (WhatsApp + Email)
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { subscriptionId, amount, note } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ message: "subscriptionId is required" });
    }

    const sub = await Subscription.findOne({ subscriptionId })
      .populate("userId", "email phone name");

    if (!sub) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const now = new Date();
    const forMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 🔁 Prevent double manual payment
    const alreadyPaid = await Payment.findOne({
      razorpaySubscriptionId: subscriptionId,
      forMonth,
      paymentStatus: "Success",
    });

    if (alreadyPaid) {
      return res.json({
        success: true,
        message: "This month is already marked as paid",
      });
    }

    // 💾 Create MANUAL payment record
    await Payment.create({
      orderId: sub.orderId,
      razorpaySubscriptionId: subscriptionId,
      paymentType: "Recurring Payment",
      paymentMethod: "Manual",
      paymentStatus: "Success",
      amount: String(amount ?? sub.planAmount/100),
      forMonth,
      transactionId: `MANUAL-${Date.now()}`,
      note: note || "Manual payment marked by admin",
    });

    // 🔄 Reset subscription state (CRITICAL)
    sub.status = "active";
    sub.lastPaymentAt = now;
    sub.missedPayments = 0;
    sub.graceUntil = null;

    // 📅 Advance nextChargeAt by 1 month
    const currentNext = sub.nextChargeAt || now;
    sub.nextChargeAt = addMonthsSafely(currentNext, 1);

    // reset notification flags to allow next month's reminders
    sub.notifiedDue = false;
    sub.notifiedGrace = false;
    sub.notifiedStrict = false;
    sub.notifiedOnFailure = false;
    sub.notifiedOnExpiry = false;

    // Mark this cycle as handled so the cron doesn't send a "Due" message today
    const dueZero = new Date(sub.nextChargeAt);
    dueZero.setHours(0, 0, 0, 0);
    sub.lastNotifiedCycle = dueZero;

    await sub.save();

    // 🧾 Sync associated Rentals
    try {
      const rentals = await Rental.find({ subscriptionId });
      for (const rental of rentals) {
        const rCurrentNext = rental.nextBillingDate || rental.rentedDate || now;
        rental.nextBillingDate = addMonthsSafely(rCurrentNext, 1);
        rental.paymentsMade = (rental.paymentsMade || 0) + 1;
        
        if (rental.paymentsMade >= (rental.totalPaymentsRequired || 0)) {
            rental.rentalStatus = 'completed';
            rental.subscriptionStatus = 'completed';
        }
        await rental.save();
      }
      console.log(`[SkipMonth] Advanced ${rentals.length} rentals for sub ${subscriptionId}`);
    } catch (rentalErr) {
      console.error("[SkipMonth] Failed to sync rentals:", rentalErr);
    }

    // 🧾 Optional order sync
    if (sub.orderId) {
      await Order.findOneAndUpdate(
        { orderId: sub.orderId },
        { paymentStatus: "Active" }
      ).catch(() => { });
    }

    // 📣 Notify customer (FINAL SOURCE OF TRUTH)
    if (sub.userId) {
      await notify(sub, sub.userId, "MANUAL_SKIP", sub.nextChargeAt);
    }

    return res.json({
      success: true,
      message: "Month skipped successfully. Subscription remains active.",
    });
  } catch (err) {
    console.error("[ADMIN SKIP MONTH]", err);
    return res.status(500).json({
      success: false,
      message: "Failed to skip month",
    });
  }
});

module.exports = router;
