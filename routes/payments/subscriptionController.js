const razorpay = require("../../services/razorpayClient");
const Subscription = require("../../models/subscription");

/**
 * Cancel a subscription (Immediate cancel)
 * - Cancels on Razorpay
 * - Updates DB status
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "subscriptionId is required",
      });
    }

    // 1️⃣ Find subscription in DB
    const subDoc = await Subscription.findOne({ subscriptionId });

    if (!subDoc) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Already cancelled? (idempotent)
    if (subDoc.status === "cancelled") {
      return res.json({
        success: true,
        message: "Subscription already cancelled",
      });
    }

    // 2️⃣ Cancel in Razorpay
    await razorpay.subscriptions.cancel(subscriptionId);

    // 3️⃣ Update DB
    subDoc.status = "cancelled";
    subDoc.cancelledAt = new Date();
    subDoc.nextChargeAt = null;
    subDoc.graceUntil = null;
    subDoc.notifiedOnExpiry = false;

    await subDoc.save();
 
    // 4️⃣ Sync Related Rentals
    try {
      const Rental = require("../../models/rentalProducts");
      await Rental.updateMany(
        { subscriptionId: subDoc.subscriptionId },
        { $set: { subscriptionStatus: "cancelled" } }
      );
    } catch (rentalErr) {
      console.error("❌ Rental Sync (Cancel) Error:", rentalErr);
    }

    return res.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (err) {
    console.error("❌ Cancel subscription error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: err?.error?.description || err.message,
    });
  }
};
