const express = require('express');
const router = express.Router();

const verifyToken = require('../../middlewares/verifyToken');
const Payment = require('../../models/payment');
const Subscription = require('../../models/subscription');
const Order = require('../../models/orders');
const { getSubscriptionStatus, GRACE_DAYS } = require('../../utils/subscriptionStatusHelper');

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

/**
 * GET /payments/recurringPayments/current
 * Returns all relevant subscriptions + if they paid this month
 * cycleStatus: 'paid' | 'not_due_yet' | 'in_grace' | 'overdue' | 'unknown'
 */
router.get('/current', verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const { start, end } = getMonthRange(now);

    // 1) relevant subs
    const subs = await Subscription.find({
      status: { $in: ['created', 'active', 'past_due'] },
    })
      .populate('userId', 'username email phone customerId')
      .lean();

    const subIds = subs.map((s) => s.subscriptionId);

    // 2) 성공한 정기 결제 (Dashboard logic aligned with Cron cycle-based check)
    // No longer querying by fixed calendar month range for individual subs.
    // Instead, we will calculate cycle based status per row.

    // 3) Build rows
    const rows = await Promise.all(
      subs.map(async (sub) => {
        // 🔄 Optimized Billing Cycle Logic (Aligned with Cron)
        const nextChargeAtDate = sub.nextChargeAt ? new Date(sub.nextChargeAt) : null;
        const cycleStartDate = nextChargeAtDate ? new Date(nextChargeAtDate) : null;
        if (cycleStartDate) cycleStartDate.setMonth(cycleStartDate.getMonth() - 1);

        const hasPaidThisCycle = sub.lastPaymentAt && cycleStartDate && sub.lastPaymentAt >= cycleStartDate;

        const graceUntil =
          sub.graceUntil ||
          (nextChargeAtDate
            ? new Date(
              new Date(nextChargeAtDate).setDate(
                nextChargeAtDate.getDate() + GRACE_DAYS
              )
            )
            : null);

        const cycleStatus = getSubscriptionStatus(nextChargeAtDate, hasPaidThisCycle ? { _id: 'dummy' } : null).toLowerCase().replace(' ', '_');

        // attach order if available
        let orderDoc = null;
        if (sub.orderInternalId) {
          orderDoc = await Order.findById(sub.orderInternalId)
            .select('orderId totalAmount paymentType paymentStatus')
            .lean()
            .catch(() => null);
        } else if (sub.orderId) {
          orderDoc = await Order.findOne({ orderId: sub.orderId })
            .select('orderId totalAmount paymentType paymentStatus')
            .lean()
            .catch(() => null);
        }

        return {
          subscriptionId: sub.subscriptionId,
          status: sub.status,
          user: sub.userId || null,
          order: orderDoc || null,
          planAmount: sub.planAmount || 0,
          currency: sub.currency || 'INR',
          nextChargeAt: nextChargeAtDate,
          graceUntil,
          lastPaymentAt: sub.lastPaymentAt || null,
          missedPayments: sub.missedPayments || 0,
          hasPaidThisMonth: hasPaidThisCycle,
          cycleStatus,
        };
      })
    );

    // Filter out rows representing Abandoned/Failed/Pending Initial Checkouts, and Ghost Orders
    const validRows = rows.filter(r => {
      if (!r.order) return false; // If the parent Order is entirely missing/deleted from the DB, throw out the ghost subscription
      if (r.order.status === 'Cancelled' || r.order.status === 'Pending') return false;
      if (r.order.paymentStatus === 'Failed' || r.order.paymentStatus === 'Pending' || r.order.paymentStatus === 'Processing Authorization') return false;
      return true;
    });

    res.json({
      success: true,
      monthStart: start,
      monthEnd: end,
      total: validRows.length,
      data: validRows,
    });
  } catch (err) {
    console.error('[GET /payments/recurringPayments/current] error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recurring payment status',
    });
  }
});

module.exports = router;
