const express = require("express");
const router = express.Router();

const User = require("../../models/auth");
const Payment = require("../../models/payment");
const Subscription = require("../../models/subscription");
const Order = require("../../models/orders");
const { getSubscriptionStatus, GRACE_DAYS } = require("../../utils/subscriptionStatusHelper");

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

// Utility: last N months labels (for frontend charts)
function buildMonthKey(year, month) {
  // month: 1-12
  const d = new Date(year, month - 1, 1);
  const short = d.toLocaleString("en-US", { month: "short" });
  return {
    label: `${short} ${String(year).slice(-2)}`, // e.g. "Jan 25"
    month,
    year,
  };
}

/**
 * GET /analytics/billing
 * High-level payments + orders analytics
 */
router.get("/billing", async (req, res) => {
  try {
    const now = new Date();
    const { start, end } = getMonthRange(now);

    const successStatuses = ["Success", "Completed"];

    /* ---------- USERS ---------- */
    const totalUsers = await User.countDocuments({});
    const monthlyNewUsers = await User.countDocuments({
      createdAt: { $gte: start, $lt: end },
    });

    /* ---------- SUBSCRIPTIONS (only high-level here) ---------- */
    const totalSubscriptions = await Subscription.countDocuments({});
    const totalActiveSubscriptions = await Subscription.countDocuments({
      status: "active",
    });

    /* ---------- PAYMENTS SUMMARY ---------- */
    // All-time paid
    const [paidAgg] = await Payment.aggregate([
      {
        $match: { paymentStatus: { $in: successStatuses } },
      },
      {
        $group: {
          _id: null,
          totalPaidAmount: { $sum: { $toDouble: "$amount" } },
          totalPaidCount: { $sum: 1 },
        },
      },
    ]);

    // Monthly paid
    const [monthlyPaidAgg] = await Payment.aggregate([
      {
        $match: {
          paymentStatus: { $in: successStatuses },
          paymentDate: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          monthlyPaidAmount: { $sum: { $toDouble: "$amount" } },
          monthlyPaidCount: { $sum: 1 },
        },
      },
    ]);

    // Pending / failed
    const [pendingAgg] = await Payment.aggregate([
      {
        $match: {
          paymentStatus: { $in: ["Failed"] },
        },
      },
      {
        $group: {
          _id: null,
          totalPendingAmount: { $sum: { $toDouble: "$amount" } },
          totalPendingCount: { $sum: 1 },
        },
      },
    ]);

    // Breakdown by paymentStatus
    const paymentStatusBreakdownRaw = await Payment.aggregate([
      {
        $group: {
          _id: "$paymentStatus",
          totalAmount: { $sum: { $toDouble: "$amount" } },
          count: { $sum: 1 },
        },
      },
    ]);

    const paymentStatusBreakdown = paymentStatusBreakdownRaw.map((p) => ({
      status: p._id || "Unknown",
      amount: p.totalAmount || 0,
      count: p.count || 0,
    }));

    // Breakdown by paymentType
    const paymentTypeBreakdownRaw = await Payment.aggregate([
      {
        $group: {
          _id: "$paymentType",
          totalAmount: { $sum: { $toDouble: "$amount" } },
          count: { $sum: 1 },
        },
      },
    ]);

    const paymentTypeBreakdown = paymentTypeBreakdownRaw.map((p) => ({
      paymentType: p._id || "Unknown",
      amount: p.totalAmount || 0,
      count: p.count || 0,
    }));

    /* ---------- MONTHLY REVENUE (last 12 months) ---------- */
    const monthlyRaw = await Payment.aggregate([
      {
        $match: {
          paymentStatus: { $in: successStatuses },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$paymentDate" },
            month: { $month: "$paymentDate" },
          },
          totalAmount: { $sum: { $toDouble: "$amount" } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Transform & keep last 12
    const monthlyRevenue = monthlyRaw.map((m) => {
      const year = m._id.year;
      const month = m._id.month;
      const meta = buildMonthKey(year, month);
      return {
        year,
        month,
        label: meta.label,
        totalAmount: m.totalAmount || 0,
      };
    });

    const monthlyRevenueLast12 =
      monthlyRevenue.length > 12
        ? monthlyRevenue.slice(monthlyRevenue.length - 12)
        : monthlyRevenue;

    /* ---------- REVENUE BY PRODUCT ---------- */
    const revenueByProductRaw = await Order.aggregate([
      {
        $match: {
          paymentStatus: { $in: ["Paid", "Active"] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productName",
          revenue: { $sum: "$items.rent" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    const revenueByProduct = revenueByProductRaw.map((p) => ({
      productName: p._id || "Unknown",
      revenue: p.revenue || 0,
      orders: p.orders || 0,
    }));

    /* ---------- REVENUE BY STATE ---------- */
    const revenueByStateRaw = await Order.aggregate([
      {
        $match: {
          paymentStatus: { $in: ["Paid", "Active"] },
        },
      },
      {
        $group: {
          _id: "$billingInfo.state",
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const revenueByState = revenueByStateRaw.map((s) => ({
      state: s._id || "Unknown",
      revenue: s.revenue || 0,
      orders: s.orders || 0,
    }));

    return res.json({
      success: true,
      data: {
        summary: {
          totalUsers,
          monthlyNewUsers,
          totalSubscriptions,
          totalActiveSubscriptions,
          totalPaidAmount: paidAgg?.totalPaidAmount || 0,
          totalPaidCount: paidAgg?.totalPaidCount || 0,
          monthlyPaidAmount: monthlyPaidAgg?.monthlyPaidAmount || 0,
          monthlyPaidCount: monthlyPaidAgg?.monthlyPaidCount || 0,
          totalPendingAmount: pendingAgg?.totalPendingAmount || 0,
          totalPendingCount: pendingAgg?.totalPendingCount || 0,
        },
        paymentStatusBreakdown,
        paymentTypeBreakdown,
        monthlyRevenue: monthlyRevenueLast12,
        revenueByProduct,
        revenueByState,
      },
    });
  } catch (err) {
    console.error("[GET /analytics/billing] error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch billing analytics",
    });
  }
});

/**
 * GET /analytics/subscriptions
 * Deep analytics for recurring subscriptions:
 * - who paid this month
 * - who is not due yet
 * - who is in grace
 * - who is overdue
 */
router.get("/subscriptions", async (req, res) => {
  try {
    const now = new Date();
    const { start, end } = getMonthRange(now);

    // 1) relevant subs (similar to /payments/recurringPayments/current)
    const subs = await Subscription.find({
      status: { $in: ["created", "active", "past_due"] },
    })
      .populate("userId", "username email phone customerId")
      .lean();

    const subIds = subs.map((s) => s.subscriptionId);

    // 2) successful recurring payments THIS month
    const successStatuses = ["Success", "Completed"];
    const paidThisMonth = await Payment.find({
      paymentType: "Recurring Payment",
      paymentStatus: { $in: successStatuses },
      razorpaySubscriptionId: { $in: subIds },
      forMonth: { $gte: start, $lt: end },
    })
      .select("razorpaySubscriptionId amount")
      .lean();

    const paidSet = new Set(
      paidThisMonth.map((p) => p.razorpaySubscriptionId)
    );

    // Map for amounts per subscription (this month)
    const amountBySubId = {};
    for (const p of paidThisMonth) {
      const key = p.razorpaySubscriptionId;
      const amt = Number(p.amount || 0);
      amountBySubId[key] = (amountBySubId[key] || 0) + amt;
    }

    // Aggregated stats
    const countsByCycle = {
      paid: 0,
      not_due_yet: 0,
      in_grace: 0,
      overdue: 0,
      unknown: 0,
    };

    const amountByCycle = {
      paid: 0,
      not_due_yet: 0,
      in_grace: 0,
      overdue: 0,
      unknown: 0,
    };

    // Optionally build lists of users per cycle status
    const examplesByCycle = {
      paid: [],
      not_due_yet: [],
      in_grace: [],
      overdue: [],
      unknown: [],
    };

    for (const sub of subs) {
      const hasPaidThisMonth = paidSet.has(sub.subscriptionId);
      const nextChargeAt = sub.nextChargeAt ? new Date(sub.nextChargeAt) : null;

      let graceUntil = sub.graceUntil ? new Date(sub.graceUntil) : null;
      if (!graceUntil && nextChargeAt) {
        const g = new Date(nextChargeAt);
        g.setDate(g.getDate() + GRACE_DAYS);
        graceUntil = g;
      }

      const cycleStatus = getSubscriptionStatus(nextChargeAt, hasPaidThisMonth ? { _id: 'dummy' } : null).toLowerCase().replace(' ', '_');

      const paidAmt = amountBySubId[sub.subscriptionId] || 0;

      countsByCycle[cycleStatus] = (countsByCycle[cycleStatus] || 0) + 1;
      amountByCycle[cycleStatus] =
        (amountByCycle[cycleStatus] || 0) + paidAmt;

      // collect small examples for UI tooltips (not full tables)
      if (examplesByCycle[cycleStatus].length < 5) {
        examplesByCycle[cycleStatus].push({
          subscriptionId: sub.subscriptionId,
          planAmount: sub.planAmount || 0,
          user: sub.userId || null,
          nextChargeAt,
          graceUntil,
        });
      }
    }

    const totalSubs = subs.length;

    res.json({
      success: true,
      data: {
        totalSubscriptions: totalSubs,
        countsByCycle,
        amountByCycle,
        examplesByCycle,
      },
    });
  } catch (err) {
    console.error("[GET /analytics/subscriptions] error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription analytics",
    });
  }
});

module.exports = router;
