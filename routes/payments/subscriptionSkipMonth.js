const express = require("express");
const router = express.Router();

const Subscription = require("../../models/subscription");
const Payment = require("../../models/payment");
const Order = require("../../models/orders");
const Rental = require("../../models/rentalProducts");
const verifyToken = require("../../middlewares/verifyToken");
const notify = require("../../utils/subscriptionNotifier");

// Helper function to add months safely while preserving the billing day
function addMonthsSafely(date, months, originalDay) {
  const result = new Date(date);
  const currentMonth = result.getMonth();
  result.setMonth(currentMonth + months);
  
  if (originalDay) {
    result.setDate(originalDay);
    // Handle month-end issues (e.g., Feb 30 -> Feb 28)
    if (result.getMonth() !== (currentMonth + months) % 12) {
       result.setDate(0);
    }
  } else {
    if (result.getMonth() !== (currentMonth + months) % 12) {
      result.setDate(0);
    }
  }
  return result;
}

/**
 * ADMIN: Skip current month (manual payment)
 * - Records manual payment
 * - Syncs with Subscription and all related Rentals
 * - Enforces originalBillingDay to prevent date drift
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { subscriptionId, amount, note } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ success: false, message: "subscriptionId is required" });
    }

    const sub = await Subscription.findOne({ subscriptionId })
      .populate("userId", "email phone name");

    if (!sub) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    const now = new Date();
    const forMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 🔁 Prevent double manual payment for same month bucket
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
      userId: sub.userId?._id,
      paymentType: "Recurring Payment",
      paymentMethod: "Manual",
      paymentStatus: "Success",
      amount: String(amount ?? sub.planAmount/100),
      forMonth,
      transactionId: `MANUAL-SKIP-${Date.now()}`,
      note: note || "Manual skip/payment marked by admin",
    });

    // 🔄 Sync Subscription state
    sub.status = "active";
    sub.lastPaymentAt = now;
    sub.missedPayments = 0;
    sub.graceUntil = null;

    // 📅 Advance nextChargeAt by 1 month, preserving the billing day
    // We try to find the billing day from related rentals or fallback to rentedDate
    const relatedRental = await Rental.findOne({ subscriptionId });
    const billingDay = relatedRental?.originalBillingDay || sub.nextChargeAt?.getDate() || now.getDate();

    const currentNext = sub.nextChargeAt || now;
    sub.nextChargeAt = addMonthsSafely(currentNext, 1, billingDay);

    // Reset notification flags
    sub.notifiedDue = false;
    sub.notifiedGrace = false;
    sub.notifiedStrict = false;
    sub.notifiedOnFailure = false;
    sub.notifiedTwoDaysBefore = false;

    // Mark as handled for this cycle
    const dueZero = new Date(sub.nextChargeAt);
    dueZero.setHours(0, 0, 0, 0);
    sub.lastNotifiedCycle = dueZero;

    await sub.save();

    // 🧾 Sync all associated Rentals
    try {
      const rentals = await Rental.find({ subscriptionId });
      for (const rental of rentals) {
        const bDay = rental.originalBillingDay || billingDay;
        const rCurrentNext = rental.nextBillingDate || rental.rentedDate || now;
        
        rental.nextBillingDate = addMonthsSafely(rCurrentNext, 1, bDay);
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

    if (sub.userId) {
      await notify(sub, sub.userId, "MANUAL_SKIP", sub.nextChargeAt).catch(() => {});
    }

    return res.json({
      success: true,
      message: "Month skipped successfully. Subscription and rentals synced.",
      nextAutoPaymentDate: sub.nextChargeAt
    });
  } catch (err) {
    console.error("[ADMIN SKIP MONTH] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to skip month",
      error: err.message
    });
  }
});

module.exports = router;
