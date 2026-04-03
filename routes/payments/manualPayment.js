const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const router = express.Router();
const Rental = require('../../models/rentalProducts');
const Order = require('../../models/orders');
const Payment = require('../../models/payment');
const Subscription = require('../../models/subscription');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const notify = require('../../utils/subscriptionNotifier');

dotenv.config();

// Helper to add months safely while preserving the billing day
function addMonthsSafely(date, months, originalDay) {
  const result = new Date(date);
  const currentMonth = result.getMonth();
  result.setMonth(currentMonth + months);
  
  // Enforce original billing day (e.g., if we were on the 31st and advanced to Feb, set to 28th)
  // If originalDay is provided, we use it as the target DAY.
  if (originalDay) {
    result.setDate(originalDay);
    if (result.getMonth() !== (currentMonth + months) % 12) {
       result.setDate(0); // Roll back to last day of the intended month
    }
  } else {
    if (result.getMonth() !== (currentMonth + months) % 12) {
      result.setDate(0);
    }
  }
  return result;
}

/**
 * MANUAL PAYMENT: Records a payment (cash/bank transfer) for a specific rental.
 * - Updates Rental record (paymentsMade, emiHistory)
 * - Updates Subscription record (nextChargeAt, lastPaymentAt)
 * - Keeps Admin Dashboard compatibility
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { rentalId, amount, note } = req.body;
    const { userId } = req.user;

    // 1. Verify rental
    const rental = await Rental.findOne({ _id: rentalId, userId })
      .populate('productId')
      .populate('orderId');

    if (!rental) {
      return res.status(404).json({ message: "Rental record not found" });
    }

    if (rental.rentalStatus === 'completed') {
      return res.status(400).json({ message: "Rental is already completed" });
    }

    if (rental.paymentsMade >= rental.totalPaymentsRequired) {
      return res.status(400).json({ message: "All payments already completed for this rental" });
    }

    const now = new Date();
    const cycleMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Process manual payment via model helper
    const transactionId = `MANUAL-${Date.now()}`;
    const paymentPeriod = await rental.recordManualPayment(transactionId);

    // 3. Create Payment document
    const newPayment = await Payment.create({
      orderId: rental.orderId?.orderId || `MANUAL-${Date.now()}`,
      rentalId: rental._id,
      userId: userId,
      paymentMethod: 'Manual',
      paymentType: 'Recurring Payment',
      amount: String(amount || (rental.productId?.rentalPrice * 1.18).toFixed(2)),
      paymentStatus: 'Success',
      transactionId: transactionId,
      forMonth: paymentPeriod,
      note: note || "Manual payment recorded"
    });

    // 4. SYNC WITH SUBSCRIPTION (CRITICAL FIX)
    if (rental.subscriptionId) {
      const sub = await Subscription.findOne({ subscriptionId: rental.subscriptionId });
      if (sub) {
        sub.status = "active";
        sub.lastPaymentAt = now;
        sub.missedPayments = 0;
        sub.graceUntil = null;

        // Advance nextChargeAt by 1 month, respecting the original billing day
        const billingDay = rental.originalBillingDay || new Date(rental.rentedDate).getDate();
        sub.nextChargeAt = addMonthsSafely(sub.nextChargeAt || now, 1, billingDay);

        // Reset notification flags for the new cycle
        sub.notifiedDue = false;
        sub.notifiedGrace = false;
        sub.notifiedStrict = false;
        sub.notifiedOnFailure = false;
        
        // Mark as notified for this cycle so cron doesn't double-task today
        const dueZero = new Date(sub.nextChargeAt);
        dueZero.setHours(0, 0, 0, 0);
        sub.lastNotifiedCycle = dueZero;

        await sub.save();

        // 📣 Notify customer
        await notify(sub, sub.userId, "MANUAL_SKIP", sub.nextChargeAt).catch(e => console.error("Notification failed", e));
      }
    }

    // 5. Update Rental next billing date to stay in sync
    const billingDay = rental.originalBillingDay || new Date(rental.rentedDate).getDate();
    rental.nextBillingDate = addMonthsSafely(rental.nextBillingDate || now, 1, billingDay);
    await rental.save();

    return res.json({
      success: true,
      message: "Manual payment recorded and subscription synced",
      paymentsMade: rental.paymentsMade,
      remainingPayments: rental.totalPaymentsRequired - rental.paymentsMade,
      nextBillingDate: rental.nextBillingDate
    });

  } catch (error) {
    console.error("Manual payment logic error:", error);
    res.status(500).json({
      success: false,
      message: "Payment processing failed",
      error: error.message
    });
  }
});

module.exports = router;
