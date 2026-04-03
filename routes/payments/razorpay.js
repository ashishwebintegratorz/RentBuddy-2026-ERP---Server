const express = require("express");
const router = express.Router();
const razorpay = require("../../services/razorpayClient");
const verifyToken = require("../../middlewares/verifyToken");
const Crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../../models/payment");
const Order = require("../../models/orders");
const Cart = require("../../models/carts");
const Product = require("../../models/product");
const Barcode = require("../../models/barcode");
const Rental = require("../../models/rentalProducts");
const Invoice = require("../../models/invoice");
const RentalHistory = require("../../models/rentalHistory");

const { fulfilOrderAfterPayment } = require("../../services/fulfilment.service");

require("dotenv").config();

/* -------------------------- Razorpay routes -------------------------- */

// optional helper
router.post("/session", verifyToken, async (req, res) => {
  try {
    const { amount, currency = "INR", receipt = "", notes = {} } = req.body;
    if (!amount || isNaN(amount))
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });

    const options = {
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      payment_capture: 1,
      notes,
    };
    const order = await razorpay.orders.create(options);
    return res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    });
  } catch (err) {
    console.error("[razorpay/session] error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create razorpay order",
    });
  }
});

// ✅ verify payment and trigger fulfilment
router.post("/verify-payment", verifyToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId, // internal _id or public orderId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Missing razorpay payload" });
    }

    const hmac = Crypto.createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET
    );
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expectedSignature = hmac.digest("hex");
    if (expectedSignature !== razorpay_signature) {
      console.warn("[razorpay/verify-payment] signature mismatch", {
        expectedSignature,
        razorpay_signature,
      });
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    // 1) Update Payment
    let payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        $set: {
          paymentStatus: "Success",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          transactionId: razorpay_payment_id,
        },
      },
      { new: true }
    ).catch(() => null);

    if (!payment && orderId) {
      payment = await Payment.findOneAndUpdate(
        { orderId: orderId.toString() },
        {
          $set: {
            paymentStatus: "Success",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            transactionId: razorpay_payment_id,
          },
        },
        { new: true }
      ).catch(() => null);
    }

    // 2) Update order basic status
    async function finalizeOrderUpdate(orderIdOrInternal) {
      if (!orderIdOrInternal) return null;

      if (mongoose.Types.ObjectId.isValid(orderIdOrInternal)) {
        const ord = await Order.findByIdAndUpdate(
          orderIdOrInternal,
          { paymentStatus: "Paid", status: "Completed" },
          { new: true }
        ).catch(() => null);
        if (ord) return ord;
      }

      const ord = await Order.findOneAndUpdate(
        { orderId: orderIdOrInternal },
        { paymentStatus: "Paid", status: "Completed" },
        { new: true }
      ).catch(() => null);
      return ord;
    }

    let finalOrder = null;

    if (orderId) {
      finalOrder = await finalizeOrderUpdate(orderId);
    } else {
      finalOrder = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { paymentStatus: "Paid", status: "Completed" },
        { new: true }
      ).catch(() => null);
    }

    // 3) fulfil (barcodes, rentals, invoice, cart clear)
    let invoice = null;
    if (finalOrder) {
      try {
        console.log("[verify-payment] Starting fulfilment for order:", finalOrder._id);
        const fulfilmentResult = await fulfilOrderAfterPayment(finalOrder._id);
        invoice = fulfilmentResult?.invoice;

        console.log("[verify-payment] Invoice retrieved:", invoice ? invoice._id : "NOT FOUND");

        // ✅ NEW: Update Payment with the real Invoice ID
        if (invoice && payment) {
          await Payment.findByIdAndUpdate(payment._id, {
            invoiceId: invoice._id
          });
          console.log(`[verify-payment] Linked Invoice ${invoice._id} to Payment ${payment._id}`);
        }
      } catch (e) {
        console.error("[verify-payment] fulfilment failed", e);
      }
    }

    return res.json({
      success: true,
      message: "Payment verified and order finalized",
      payment,
      invoice,
    });
  } catch (err) {
    console.error("[razorpay/verify-payment] error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "verification failed" });
  }
});

// ✅ Handle Payment Failure
router.post("/payment-failed", verifyToken, async (req, res) => {
  try {
    const {
      orderId, // internal _id or public orderId
      razorpay_order_id,
      razorpay_payment_id,
      reason
    } = req.body;

    console.log("[razorpay/payment-failed] received failure report:", req.body);

    // 1. Mark Payment as Failed
    let paymentQuery = {};
    if (razorpay_order_id) paymentQuery.razorpayOrderId = razorpay_order_id;
    else if (orderId) paymentQuery.orderId = orderId.toString();

    if (Object.keys(paymentQuery).length > 0) {
      await Payment.findOneAndUpdate(
        paymentQuery,
        {
          $set: {
            paymentStatus: "Failed",
            razorpayPaymentId: razorpay_payment_id,
            transactionId: razorpay_payment_id,
            // You might want to store the failure reason in a notes field or similar
          }
        }
      ).catch(e => console.error("Failed to update payment failure status", e));
    }

    // 2. Mark Order as Cancelled (or just Payment Failed)
    // using 'Cancelled' from your enum
    let orderQuery = {};
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      orderQuery._id = orderId;
    } else if (orderId) {
      orderQuery.orderId = orderId;
    } else if (razorpay_order_id) {
      orderQuery.razorpayOrderId = razorpay_order_id;
    }

    if (Object.keys(orderQuery).length > 0) {
      await Order.findOneAndUpdate(
        orderQuery,
        {
          $set: {
            status: "Cancelled",
            paymentStatus: "Failed"
          }
        }
      ).catch(e => console.error("Failed to update order failure status", e));
    }

    return res.json({ success: true, message: "Marked as failed" });

  } catch (err) {
    console.error("[razorpay/payment-failed] error:", err);
    return res.status(500).json({ success: false, message: "Error recording failure" });
  }
});

module.exports = router;