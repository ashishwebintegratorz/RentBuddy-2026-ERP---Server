// routes/orders/checkSubscriptionStatus.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../../middlewares/verifyToken");
const Subscription = require("../../models/subscription");
const Order = require("../../models/orders");
const mongoose = require("mongoose");

router.get("/", verifyToken, async (req, res) => {
  try {
    // Prevent caching and ETag-based 304 responses for this polling endpoint
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private, max-age=0"
    );
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    // ensure ETag not used for this response
    res.set("ETag", "");

    const { orderId } = req.query;
    if (!orderId)
      return res
        .status(400)
        .json({ success: false, message: "orderId required" });

    let subDoc = null;

    // try as internal _id mapped subscription
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      subDoc = await Subscription.findOne({ orderInternalId: orderId })
        .lean()
        .catch(() => null);
      if (!subDoc) {
        const ord = await Order.findById(orderId).lean().catch(() => null);
        if (ord && ord.subscriptionId) {
          subDoc = await Subscription.findOne({
            subscriptionId: ord.subscriptionId,
          })
            .lean()
            .catch(() => null);
        }
      }
    }

    // fallback: try by public orderId string (ORD-xxxxx)
    if (!subDoc) {
      subDoc = await Subscription.findOne({ orderId }).lean().catch(() => null);
      if (!subDoc) {
        const ord = await Order.findOne({ orderId }).lean().catch(() => null);
        if (ord && ord.subscriptionId) {
          subDoc = await Subscription.findOne({
            subscriptionId: ord.subscriptionId,
          })
            .lean()
            .catch(() => null);
        }
      }
    }

    console.log(
      "[check-subscription-status] found subscription doc:",
      !!subDoc,
      "for orderId:",
      orderId
    );

    if (!subDoc) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found for provided orderId",
      });
    }

    const rawStatus = (subDoc.status || "").toLowerCase();
    let status = "pending";

    // Success if explicitly active OR if isMandateAuthorized flag is set
    if (rawStatus === "active" || subDoc.isMandateAuthorized === true || rawStatus === "authenticated") {
      status = "active";
    } else if (
      rawStatus === "past_due" ||
      rawStatus === "paused" ||
      rawStatus === "pending" ||
      rawStatus === "created"
    ) {
      status = "pending";
    } else if (
      rawStatus === "cancelled" ||
      rawStatus === "cancel" ||
      rawStatus === "deleted"
    ) {
      status = "cancelled";
    } else if (rawStatus === "completed") {
      status = "completed";
    } else {
      status = rawStatus || "pending";
    }

    return res.json({
      success: true,
      status,
      subscriptionId: subDoc.subscriptionId || null,
      nextChargeAt: subDoc.nextChargeAt || null,
      startAt: subDoc.startAt || null,
      shortUrl: subDoc.shortUrl || subDoc.short_url || null,
      raw: subDoc.raw || null,
    });
  } catch (err) {
    console.error("[check-subscription-status] error", err);
    return res.status(500).json({
      success: false,
      message: err.message || "server error",
    });
  }
});

module.exports = router;
