// routes/subscription/index.js
const express = require('express');
const router = express.Router();

const Subscription = require('../../models/subscription');
const verifyToken = require('../../middlewares/verifyToken');
const { getSubscriptionStatus } = require('../../utils/subscriptionStatusHelper');

/* -------------------------- helpers -------------------------- */

/**
 * Calculate approximate remaining duration (months + days) until `endDate`.
 * - endDate can be nextChargeAt OR graceUntil
 * - months are approximated as 30 days
 */
function calculateRemainingDuration(endDate) {
  if (!endDate) {
    return { totalDays: 0, months: 0, days: 0 };
  }

  const now = new Date();
  const end = new Date(endDate);

  if (now >= end) {
    return { totalDays: 0, months: 0, days: 0 };
  }

  const diffMs = end.getTime() - now.getTime();
  const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const months = Math.floor(totalDays / 30); // approx
  const days = totalDays - months * 30;

  return { totalDays, months, days };
}

/**
 * Choose which date to consider as "valid till":
 * - Prefer graceUntil if set (user is in grace period)
 * - Otherwise use nextChargeAt
 */
function getEffectiveEndDate(subscription) {
  if (!subscription) return null;
  if (subscription.graceUntil) return subscription.graceUntil;
  if (subscription.nextChargeAt) return subscription.nextChargeAt;
  return null;
}

/* -------------------------- routes -------------------------- */

/**
 * GET /api/subscription/isSubscribed
 * Check if current user has an active subscription and return remaining duration.
 */
router.get('/isSubscribed', async (req, res) => {
  try {
    const userId = req.user.userId;

    // get latest subscription of the user with "non-final" status
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['created', 'active', 'past_due'] },
    })
      .sort({ createdAt: -1 })
      .exec();

    if (!subscription) {
      return res.status(200).json({
        success: false,
        message: 'No active subscription found for this user!',
        isActive: false,
      });
    }

    const now = new Date();
    const effectiveEnd = getEffectiveEndDate(subscription);

    const { totalDays, months, days } = calculateRemainingDuration(effectiveEnd);

    let isActive = false;

    // Use helper to check if they are still within valid period (Upcoming, Due, In Grace)
    const currentStatus = getSubscriptionStatus(subscription.nextChargeAt, null);
    if (subscription.status === 'active' || subscription.status === 'created' || subscription.status === 'past_due') {
      isActive = ['Upcoming', 'Due Today', 'In Grace'].includes(currentStatus);
    }

    return res.status(200).json({
      success: true,
      isActive,
      status: subscription.status,
      duration: `${months} months and ${days} days`,
      remainingDays: totalDays,
      nextChargeAt: subscription.nextChargeAt,
      graceUntil: subscription.graceUntil,
      planAmount: subscription.planAmount,
      currency: subscription.currency || 'INR',
      subscriptionId: subscription.subscriptionId,
    });
  } catch (error) {
    console.error('[GET /subscription/isSubscribed] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/subscription
 * Admin: Get all subscriptions with user + order info and key fields from new schema
 */
router.get('/', async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('userId')          // populate user details
      .populate('orderInternalId') // populate order
      .sort({ createdAt: -1 })
      .exec();

    if (!subscriptions.length) {
      return res
        .status(404)
        .json({ success: false, message: 'No subscriptions found' });
    }

    const formattedSubscriptions = subscriptions.map((subscription) => {
      const s = subscription.toObject();

      const effectiveEnd = getEffectiveEndDate(subscription);
      const { totalDays, months, days } = calculateRemainingDuration(
        effectiveEnd
      );

      return {
        // core DB identifiers
        _id: s._id,
        subscriptionId: s.subscriptionId,

        // status & timing
        status: s.status,
        startAt: s.startAt,
        nextChargeAt: s.nextChargeAt,
        graceUntil: s.graceUntil,
        lastPaymentAt: s.lastPaymentAt,
        missedPayments: s.missedPayments,

        // price/plan info
        planId: s.planId,
        planAmount: s.planAmount,
        currency: s.currency || 'INR',

        // razorpay / mandate
        mandateId: s.mandateId,
        shortUrl: s.shortUrl,

        // app metadata
        orderId: s.orderId,
        orderInternalId: s.orderInternalId
          ? s.orderInternalId._id
          : s.orderInternalId,
        orderPublicId: s.orderInternalId
          ? s.orderInternalId.orderId || s.orderId
          : s.orderId,

        // user details for admin panel
        userId: s.userId ? s.userId._id : null,
        userDetails: s.userId || null,
        userName: s.userId ? s.userId.name : null,
        userEmail: s.userId ? s.userId.email : null,
        userPhone: s.userId ? s.userId.phone : null,

        // notification flags
        notifiedOnFailure: s.notifiedOnFailure,
        notifiedTwoDaysBefore: s.notifiedTwoDaysBefore,
        notifiedOnExpiry: s.notifiedOnExpiry,

        // remaining duration (for quick view in admin)
        remainingDays: totalDays,
        remainingDurationLabel: `${months} months ${days} days`,

        // timestamps
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    // keep same shape as your previous code (message holds array)
    return res.status(200).json({
      success: true,
      message: formattedSubscriptions,
    });
  } catch (error) {
    console.error('[GET /subscription] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;
