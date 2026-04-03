// routes/orders/addOrder.js
const express = require("express");
const router = express.Router();
require("dotenv").config();

const mongoose = require("mongoose");
const Order = require("../../models/orders");
const Invoice = require("../../models/invoice");
const Payment = require("../../models/payment");
const Rental = require("../../models/rentalProducts");
const Product = require("../../models/product");
const Cart = require("../../models/carts");
const Barcode = require("../../models/barcode");
const Subscription = require("../../models/subscription");

const verifyToken = require("../../middlewares/verifyToken");
const razorpay = require("../../services/razorpayClient");

/* -------------------------- helpers -------------------------- */

function getMonthsFromDurationString(duration) {
  if (!duration || typeof duration !== "string") return 0;
  const m = duration.match(
    /(\d+)\s*(month|months|year|years|week|weeks|day|days)/i
  );
  if (!m) return parseInt(duration, 10) || 0;
  const value = parseInt(m[1], 10) || 0;
  const unit = (m[2] || "").toLowerCase();
  switch (unit) {
    case "year":
    case "years":
      return Math.max(1, value * 12);
    case "month":
    case "months":
      return Math.max(1, value);
    case "week":
    case "weeks":
      return Math.max(1, Math.ceil(value / 4));
    case "day":
    case "days":
      return Math.max(1, Math.ceil(value / 30));
    default:
      return Math.max(1, value);
  }
}

function nextMonthTimestamp() {
  const now = new Date();
  const day = now.getDate();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  // handle end-of-month overflow
  if (next.getMonth() === (now.getMonth() + 2) % 12) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
    next.setDate(lastDay);
  }
  return Math.floor(next.getTime() / 1000);
}

/* -------------------------- route -------------------------- */

router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      billingInfo,
      items,
      isPackage,
      totalAmount,
      paymentType,
      paymentMethod,
      orderNotes,
      depositAmount = 0,
      cgst,
      igst,
      productRent,
      isFirstMonth,
      refundableDeposit,
      couponCode,
      couponDiscount,
      monthlyAmount,
    } = req.body;

    const userId = req.user.userId;
    if (!userId)
      return res.status(401).json({ message: "Unauthenticated user" });
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "No items provided" });

    if (paymentType === "Recurring Payment") {
      const monthlyBaseNum = Number(monthlyAmount);
      if (!monthlyBaseNum || isNaN(monthlyBaseNum) || monthlyBaseNum <= 0) {
        return res.status(400).json({
          message:
            "monthlyAmount is required and must be > 0 for recurring payments",
        });
      }
    }

    // ---------------------------------------------------------
    // Validate request Items to ensure Schema Compatibility
    // ---------------------------------------------------------
    const updatedItems = items.map(item => {
      // Determine type if not provided (frontend usually sends raw cart items)
      // Check payload keys: packageId vs productId
      let iType = item.itemType || 'product';
      if (!iType && item.packageId) iType = 'package';

      const baseItem = {
        itemType: iType,
        productName: item.productName || item.name || "Unknown Item",
        quantity: item.quantity || 1,
        rentalDuration: item.rentalDuration,
        price: item.price || item.rent, // backend usually expects 'price' or 'rent'
        rent: item.rent || item.price,
      };

      if (iType === 'package') {
        baseItem.packageId = item.packageId || item.productId; // careful if frontend sends packageId in 'productId' field
        // clear productId if it was mistakenly set to package Id
        baseItem.productId = undefined;
      } else {
        baseItem.productId = item.productId;
        baseItem.productSerialId = item.productSerialId;
      }
      return baseItem;
    });

    const stableOrderId = `ORD-${Date.now()}`;

    // 1. create order (Pending)
    const newOrder = new Order({
      orderId: stableOrderId,
      userId,
      billingInfo,
      items: updatedItems,
      totalAmount,
      paymentType,
      paymentMethod,
      orderNotes,
      depositAmount,
      cgst,
      // package: isPackage ? req.body.packageId : null, // ❌ Legacy field, removing reliance on it
      igst,
      productRent,
      refundableDeposit,
      couponCode,
      couponDiscount,
      status: "Pending",
      paymentStatus: "Pending",
      invoiceIds: [],
      paymentIds: [],
      barcodeIds: [],
      fulfilled: false,
    });
    await newOrder.save();

    // 2. create Payment doc (Pending) and link it to Order.paymentIds
    const newPayment = new Payment({
      orderId: newOrder._id.toString(),
      customerName: `${billingInfo.firstName} ${billingInfo.lastName}`,
      paymentMethod: paymentMethod || "Pending",
      paymentType,
      amount: (totalAmount || 0).toString(),
      paymentStatus: "Pending",
      emiDate: billingInfo.emiDate || "",
    });
    await newPayment.save();

    newOrder.paymentIds = newOrder.paymentIds || [];
    newOrder.paymentIds.push(newPayment._id);
    await newOrder.save();


    /* ---------------- razorpay flow ---------------- */

    let subscriptionResponse = null;
    let razorpayOrder = null;
    let subscriptionShortUrl = null;

    if (paymentType === "Recurring Payment") {
      try {
        const monthlyBase = Number(monthlyAmount);
        const depositNow = Math.max(0, Number(depositAmount || 0));
        const TAX_RATE = 0.18;

        const monthsPerItem = (items || []).map((it) =>
          getMonthsFromDurationString(it.rentalDuration)
        );
        const cycles = Math.max(
          1,
          ...(monthsPerItem.length ? monthsPerItem : [1])
        );

        // ---- Case: only 1 month total -> behave like one-time (no subscription) ----
        if (cycles === 1) {
          const monthlyBasePaise = Math.round(monthlyBase * 100);
          const monthlyTaxPaise = Math.round(monthlyBase * TAX_RATE * 100);
          const depositPaise = Math.round(depositNow * 100);
          const initialChargePaise =
            monthlyBasePaise + monthlyTaxPaise + depositPaise;

          const orderOptions = {
            amount: initialChargePaise,
            currency: "INR",
            receipt: `one_time_rcpt_${newOrder._id}`,
            payment_capture: 1,
            notes: {
              orderId: newOrder.orderId,
              orderInternalId: newOrder._id.toString(),
              type: "one_time_rcpt_1_month",
            },
          };

          const oneTimeOrder = await razorpay.orders.create(orderOptions);

          newPayment.razorpayOrderId = oneTimeOrder.id;
          newPayment.paymentMethod = "razorpay";
          newPayment.amount = (initialChargePaise / 100).toString();
          await newPayment.save();

          newOrder.razorpayOrderId = oneTimeOrder.id;
          newOrder.paymentStatus = "Pending";
          await newOrder.save();

          // ... (keeping previous code unchanged up to the response blocks)

          return res.status(201).json({
            message:
              "Order created: one-time payment for 1-month rental (no subscription required)",
            orderId: newOrder.orderId,
            orderInternalId: newOrder._id.toString(),
            paymentId: newPayment._id,
            razorpayOrder: oneTimeOrder,
          });
        }

        // ---- cycles > 1 -> Plan + Subscription + initial one-time order ----
        const monthlyBasePaise = Math.round(monthlyBase * 100);
        const monthlyTaxPaise = Math.round(monthlyBase * TAX_RATE * 100);
        const monthlyRecurringPaise = monthlyBasePaise + monthlyTaxPaise;

        const planPayload = {
          period: "monthly",
          interval: 1,
          item: {
            name: `PLAN-${newOrder._id}`,
            amount: monthlyRecurringPaise,
            currency: "INR",
          },
        };

        const createdPlan = await razorpay.plans.create(planPayload);

        if (
          !createdPlan ||
          !createdPlan.item ||
          Number(createdPlan.item.amount) !== Number(monthlyRecurringPaise)
        ) {
          try {
            if (createdPlan && createdPlan.id)
              await razorpay.plans.del(createdPlan.id);
          } catch (cleanupErr) {
            console.warn("Plan cleanup failed", cleanupErr);
          }
          return res.status(500).json({
            message:
              "Plan creation mismatch — aborting. Ensure monthlyAmount sent from frontend is correct",
          });
        }

        const startAtSeconds = nextMonthTimestamp();
        const remainingCycles = Math.max(0, cycles - 1);

        const subscriptionPayload = {
          plan_id: createdPlan.id,
          total_count: remainingCycles,
          quantity: 1,
          start_at: startAtSeconds,
          notes: {
            orderId: newOrder.orderId,
            orderInternalId: newOrder._id.toString(),
            emiDate: billingInfo.emiDate,
          },
        };

        const subscription = await razorpay.subscriptions.create(
          subscriptionPayload
        );
        subscriptionResponse = subscription;
        subscriptionShortUrl =
          subscription.short_url || subscription.shortUrl || null;

        newOrder.subscriptionId = subscription.id;
        newOrder.subscriptionShortUrl = subscriptionShortUrl;
        newOrder.paymentStatus = "Processing Authorization";
        await newOrder.save();

        await Subscription.findOneAndUpdate(
          { subscriptionId: subscription.id },
          {
            $set: {
              subscriptionId: subscription.id,
              orderId: newOrder.orderId,
              orderInternalId: newOrder._id,
              userId,
              planId: createdPlan.id,
              planAmount: createdPlan.item.amount,
              currency: createdPlan.item.currency || "INR",
              status: subscription.status || "created",
              startAt: subscription.start_at
                ? new Date(subscription.start_at * 1000)
                : new Date(startAtSeconds * 1000),
              nextChargeAt: subscription.next_charge_at
                ? new Date(subscription.next_charge_at * 1000)
                : new Date(startAtSeconds * 1000),
              shortUrl: subscriptionShortUrl,
              notes: subscription.notes || {},
              raw: subscription,
            },
          },
          { upsert: true, new: true }
        );

        newPayment.subscriptionShortUrl = subscriptionShortUrl;
        await newPayment.save();

        const depositPaise = Math.round(depositNow * 100);
        const initialChargePaise =
          monthlyBasePaise + monthlyTaxPaise + depositPaise;

        // 🛡️ GENERATE FALLBACK ONE-TIME PAYMENT LINK
        let oneTimePaymentLink = "";
        let oneTimePaymentLinkId = "";
        if (initialChargePaise > 0) {
          try {
            const plink = await razorpay.paymentLink.create({
              amount: initialChargePaise,
              currency: "INR",
              accept_partial: false,
              description: `Initial/Fallback payment for Order ${newOrder.orderId}`,
              customer: {
                name: `${billingInfo.firstName} ${billingInfo.lastName}`,
                email: billingInfo.email,
                contact: billingInfo.phone,
              },
              notify: { sms: true, email: true },
              reminder_enable: true,
              notes: {
                orderId: newOrder.orderId,
                orderInternalId: newOrder._id.toString(),
                type: "fallback_initial",
              },
            });
            oneTimePaymentLink = plink.short_url;
            oneTimePaymentLinkId = plink.id;

            newOrder.oneTimePaymentLink = oneTimePaymentLink;
            await Subscription.findOneAndUpdate(
              { subscriptionId: subscription.id },
              { $set: { oneTimePaymentLink, oneTimePaymentLinkId } }
            );
          } catch (plErr) {
            console.error("Fallback Payment Link creation failed (non-blocking):", plErr);
          }
        }

        let initialOrder = null;
        if (initialChargePaise > 0) {
          const orderOptions = {
            amount: initialChargePaise,
            currency: "INR",
            receipt: `initial_rcpt_${newOrder._id}`,
            payment_capture: 1,
            notes: {
              orderId: newOrder.orderId,
              orderInternalId: newOrder._id.toString(),
              type: "initial_firstmonth_plus_deposit",
            },
          };

          initialOrder = await razorpay.orders.create(orderOptions);

          newPayment.razorpayOrderId = initialOrder.id;
          newPayment.paymentMethod = "razorpay";
          newPayment.amount = (initialChargePaise / 100).toString();
          await newPayment.save();

          newOrder.razorpayOrderId = initialOrder.id;
          await newOrder.save();
        }

        return res.status(201).json({
          message:
            "Order created: subscription created (pending authorization). First month collected as initial order (if amount > 0).",
          orderId: newOrder.orderId,
          orderInternalId: newOrder._id.toString(),
          paymentId: newPayment._id,
          subscriptionId: newOrder.subscriptionId,
          subscriptionDetails: subscriptionResponse,
          authLink: subscriptionShortUrl,
          subscriptionShortUrl,
          oneTimePaymentLink: newOrder.oneTimePaymentLink,
          razorpayOrder: initialOrder,
        });
      } catch (err) {
        console.error("Razorpay plan/subscription error:", err);
        return res.status(500).json({
          message: "Failed to create subscription",
          error: err.message || err,
        });
      }
    } else {
      // One-time (cumulative) payment
      try {
        const amountToPay = Number(totalAmount || 0);
        const orderOptions = {
          amount: Math.round(amountToPay * 100),
          currency: "INR",
          receipt: `order_rcpt_${newOrder._id}`,
          payment_capture: 1,
          notes: {
            orderId: newOrder.orderId,
            orderInternalId: newOrder._id.toString(),
          },
        };
        razorpayOrder = await razorpay.orders.create(orderOptions);

        newPayment.razorpayOrderId = razorpayOrder.id;
        newPayment.paymentMethod = "razorpay";
        await newPayment.save();

        newOrder.razorpayOrderId = razorpayOrder.id;
        await newOrder.save();

        console.log("[addOrder] one-time razorpay order created:", {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
        });
      } catch (err) {
        console.error("Razorpay order create error", err);
        return res.status(500).json({
          message: "Failed to create razorpay order",
          error: err.message || err,
        });
      }
    }

    // Ensure these are strings
    const finalOrderId = newOrder.orderId;
    const finalOrderInternalId = newOrder._id.toString();

    console.log(`[addOrder] Response IDs -> Public: ${finalOrderId}, Internal: ${finalOrderInternalId}`);

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      orderId: finalOrderId,
      orderInternalId: finalOrderInternalId,
      paymentId: newPayment._id,
      subscriptionId: newOrder.subscriptionId,
      subscriptionDetails: subscriptionResponse,
      authLink: subscriptionShortUrl,
      subscriptionShortUrl,
      oneTimePaymentLink: newOrder.oneTimePaymentLink,
      razorpayOrder,
    });
  } catch (error) {
    console.error("Error in addOrder:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message || String(error),
    });
  }
});

module.exports = router; 