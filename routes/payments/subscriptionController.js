const Subscription = require("../../models/subscription");
const { cancelSubscription: unifiedCancel } = require("../../utils/cancellationHelper");

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

    console.log(`[API] Manual cancellation request for sub: ${subscriptionId}`);

    // Call unified helper
    const result = await unifiedCancel(subscriptionId, "Manual Admin Action", true);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to cancel subscription",
        error: result.razorpayStatus
      });
    }

    return res.json({
      success: true,
      message: "Subscription cancelled successfully",
      details: result
    });
    
  } catch (err) {
    console.error("❌ Cancel subscription error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: err.message,
    });
  }
};
