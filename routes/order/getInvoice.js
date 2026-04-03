const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Invoice = require("../../models/invoice");
const Subscription = require("../../models/subscription");
const User = require("../../models/auth");
const Order = require("../../models/orders");
const Payment = require("../../models/payment");
const verifyToken = require("../../middlewares/verifyToken");

/* =========================================================
   1) PAGINATED INVOICE LIST
========================================================= */
router.get("/", verifyToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const skip = (page - 1) * limit;

    const total = await Invoice.countDocuments();
    console.log("[getInvoice] total invoices:", total);

    const invoices = await Invoice.find()
      .populate({
        path: "items.productId",
        select: "productName rentalPrice deposit",
        strictPopulate: false, // 🔥 prevents crashes
      })
      .populate({
        path: "items.packageId", // ✅ NEW: populate package details
        select: "packageName monthlyPrice depositAmount",
        strictPopulate: false,
      })
      .populate({
        path: "userId",
        select: "username email phone customerId",
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log("[getInvoice] fetched:", invoices.length);

    const formattedInvoices = await Promise.all(
      invoices.map(async (invoice) => {
        const subscription = invoice.userId
          ? await Subscription.findOne({
              userId: invoice.userId._id,
            }).lean()
          : null;

        let orderDetails = null;
        if (invoice.orderInternalId) {
          orderDetails = await Order.findById(invoice.orderInternalId)
            .populate("paymentIds")
            .lean();
        }

        return {
          id: invoice._id,
          invoice_number: invoice.invoice_number,
          orderId: invoice.orderId,

          user: invoice.userId
            ? {
                id: invoice.userId._id,
                username: invoice.userId.username,
                email: invoice.userId.email,
                phone: invoice.userId.phone,
                customerId: invoice.userId.customerId,
              }
            : null,

          billingInfo: invoice.billingInfo,
          created_at: invoice.created_at,

          totalAmount: invoice.totalAmount,
          depositAmount: invoice.depositAmount,
          paymentMethod: invoice.paymentMethod,
          paymentType: invoice.paymentType,

          purchasedProducts: invoice.items
            .map((i) => {
                 // Check for packageId populated object OR productId populated object OR fallback to stored productName
                 if (i.packageId && i.packageId.packageName) return i.packageId.packageName;
                 if (i.productId && i.productId.productName) return i.productId.productName;
                 return i.productName || "Unknown Item";
            })
            .filter(Boolean),

          subscriptionDate: subscription?.startAt || null,

          items: invoice.items,
          orderDetails,
          subscriptionDetails: subscription,
        };
      })
    );

    return res.status(200).json({
      success: true,
      invoices: formattedInvoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[getInvoice] list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoices",
    });
  }
});

/* =========================================================
   2) SINGLE INVOICE BY ID
========================================================= */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    const invoice = await Invoice.findById(id)
      .populate({
        path: "items.productId",
        select: "productName rentalPrice deposit",
        strictPopulate: false,
      })
      .populate({
        path: "items.packageId", // ✅ NEW: populate package details
        select: "packageName monthlyPrice depositAmount",
        strictPopulate: false,
      })
      .populate({
        path: "userId",
        select: "username email phone customerId",
      })
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    let order = null;
    if (invoice.orderInternalId) {
      order = await Order.findById(invoice.orderInternalId)
        .populate("paymentIds")
        .lean();
    }

    let subscription = null;
    if (invoice.userId) {
      subscription = await Subscription.findOne({
        userId: invoice.userId._id,
      }).lean();
    }

    let recurringPayments = [];
    if (subscription?.subscriptionId) {
      recurringPayments = await Payment.find({
        razorpaySubscriptionId: subscription.subscriptionId,
      })
        .sort({ createdAt: 1 })
        .lean();
    }

    const subtotal =
      typeof invoice.productRent === "number"
        ? invoice.productRent
        : (invoice.totalAmount || 0) -
          (invoice.cgst || 0) -
          (invoice.igst || 0);

    return res.json({
      success: true,
      invoice: {
        id: invoice._id,
        invoice_number: invoice.invoice_number,
        created_at: invoice.created_at,

        billingInfo: invoice.billingInfo,
        userEmail: invoice.userEmail || null,
        items: invoice.items.map(i => ({
            ...i,
            // augment with name from populated doc if available, else standard fallback
            resolvedName: (i.packageId?.packageName) || (i.productId?.productName) || i.productName
        })),

        totals: {
          subtotal,
          cgst: invoice.cgst || 0,
          igst: invoice.igst || 0,
          totalAmount: invoice.totalAmount || 0,
          depositAmount: invoice.depositAmount || 0,
        },

        paymentType: invoice.paymentType,
        paymentMethod: invoice.paymentMethod,
        orderId: invoice.orderId,
        internalOrderId: invoice.orderInternalId,
        couponCode: invoice.couponCode || null,
      },

      user: invoice.userId || null,
      order,
      subscription,
      recurringPayments: recurringPayments.map((p) => ({
        id: p._id,
        createdAt: p.createdAt,
        amount: Number(p.amount || 0),
        status: p.paymentStatus,
        method: p.paymentMethod,
        razorpayPaymentId: p.razorpayPaymentId,
        invoiceId: p.invoiceId,
        paymentType: p.paymentType,
      })),
    });
  } catch (err) {
    console.error("[getInvoice/:id] error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice",
    });
  }
});

/* =========================================================
   3) INVOICE BY ORDER ID (Internal or Public)
========================================================= */
router.get("/by-order/:orderId", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log("[getInvoice] Fetching by orderId:", orderId);

    // Try to find by internal ID (if valid ObjectId) or string public ID
    let query = { $or: [{ orderId: orderId }] };
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      query.$or.push({ orderInternalId: orderId });
    }

    const invoice = await Invoice.findOne(query)
      .populate({
        path: "items.productId",
        select: "productName rentalPrice deposit",
        strictPopulate: false,
      })
      .populate({
        path: "items.packageId",
        select: "packageName monthlyPrice depositAmount",
        strictPopulate: false,
      })
      .populate({
        path: "userId",
        select: "username email phone customerId",
      })
      .lean();

    if (!invoice) {
        console.log("[getInvoice] No invoice found for order:", orderId);
      return res.status(404).json({
        success: false,
        message: "Invoice not found for this order",
      });
    }

    // Reuse the same logic to structure the response
    let order = null;
    if (invoice.orderInternalId) {
      order = await Order.findById(invoice.orderInternalId)
        .populate("paymentIds")
        .lean();
    }

    let subscription = null;
    if (invoice.userId) {
      subscription = await Subscription.findOne({
        userId: invoice.userId._id,
      }).lean();
    }

    let recurringPayments = [];
    if (subscription?.subscriptionId) {
      recurringPayments = await Payment.find({
        razorpaySubscriptionId: subscription.subscriptionId,
      })
        .sort({ createdAt: 1 })
        .lean();
    }

    const subtotal =
      typeof invoice.productRent === "number"
        ? invoice.productRent
        : (invoice.totalAmount || 0) -
          (invoice.cgst || 0) -
          (invoice.igst || 0);

    return res.json({
      success: true,
      invoice: {
        id: invoice._id,
        invoice_number: invoice.invoice_number,
        created_at: invoice.created_at,

        billingInfo: invoice.billingInfo,
        userEmail: invoice.userEmail || null,
        items: invoice.items.map((i) => ({
          ...i,
          resolvedName:
            i.packageId?.packageName ||
            i.productId?.productName ||
            i.productName,
        })),

        totals: {
          subtotal,
          cgst: invoice.cgst || 0,
          igst: invoice.igst || 0,
          totalAmount: invoice.totalAmount || 0,
          depositAmount: invoice.depositAmount || 0,
        },

        paymentType: invoice.paymentType,
        paymentMethod: invoice.paymentMethod,
        orderId: invoice.orderId,
        internalOrderId: invoice.orderInternalId,
        couponCode: invoice.couponCode || null,
      },

      user: invoice.userId || null,
      order,
      subscription,
      recurringPayments: recurringPayments.map((p) => ({
        id: p._id,
        createdAt: p.createdAt,
        amount: Number(p.amount || 0),
        status: p.paymentStatus,
        method: p.paymentMethod,
        razorpayPaymentId: p.razorpayPaymentId,
        invoiceId: p.invoiceId,
        paymentType: p.paymentType,
      })),
    });
  } catch (err) {
    console.error("[getInvoice/by-order] error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice by order",
    });
  }
});

module.exports = router;
