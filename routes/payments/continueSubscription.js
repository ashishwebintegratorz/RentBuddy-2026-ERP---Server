const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
console.log('✅ Continue Subscription Router Loaded');
const razorpay = require('../../services/razorpayClient');
const verifyToken = require('../../middlewares/verifyToken');
const Rental = require('../../models/rentalProducts');
const Subscription = require('../../models/subscription');

/**
 * Helper to add months safely to a date.
 */
function addMonthsSafely(date, months) {
  const result = new Date(date);
  const expectedMonth = (result.getMonth() + months) % 12;
  result.setMonth(result.getMonth() + months);
  if (result.getMonth() !== expectedMonth) {
    result.setDate(0);
  }
  return result;
}

function nextMonthTimestamp() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (next.getMonth() === (now.getMonth() + 2) % 12) {
    next.setDate(0);
  }
  return Math.floor(next.getTime() / 1000);
}

function getMonthsFromDurationString(duration) {
  if (!duration || typeof duration !== "string") return 1;
  const m = duration.match(/(\d+)\s*(month|months|year|years|week|weeks|day|days)/i);
  if (!m) return parseInt(duration, 10) || 1;
  const value = parseInt(m[1], 10) || 1;
  const unit = (m[2] || "").toLowerCase();
  switch (unit) {
    case "year": case "years": return Math.max(1, value * 12);
    case "month": case "months": return Math.max(1, value);
    case "week": case "weeks": return Math.max(1, Math.ceil(value / 4));
    case "day": case "days": return Math.max(1, Math.ceil(value / 30));
    default: return Math.max(1, value);
  }
}

/**
 * Shared helper to calculate the true monthly rate (normalized for Cumulative orders)
 */
async function calculateMonthlyRate(rentalIdOrOrderId) {
  const Order = require('../../models/orders');
  const Rental = require('../../models/rentalProducts');
  
  // 1. Find the Rental (Try public rentalId, Mongo _id, or linked orderId)
  const rental = await Rental.findOne({ 
    $or: [
      { rentalId: rentalIdOrOrderId }, 
      { _id: mongoose.Types.ObjectId.isValid(rentalIdOrOrderId) ? rentalIdOrOrderId : null },
      { orderId: mongoose.Types.ObjectId.isValid(rentalIdOrOrderId) ? rentalIdOrOrderId : null }
    ].filter(q => q[Object.keys(q)[0]] !== null)
  });

  // 2. Find the Order (Linked to rental or directly)
  let orderQuery = {};
  if (rental) {
    orderQuery = { $or: [{ _id: rental.orderId }, { orderId: rental.orderId }] };
  } else {
    orderQuery = { 
      $or: [
        { orderId: rentalIdOrOrderId }, 
        { _id: mongoose.Types.ObjectId.isValid(rentalIdOrOrderId) ? rentalIdOrOrderId : null }
      ].filter(q => q[Object.keys(q)[0]] !== null)
    };
  }
  const order = await Order.findOne(orderQuery).lean();
  if (!order) return null;

  // 3. Extract Duration (Prioritize Rental Doc, then Order Item)
  let durationStr = rental?.rentalDuration;
  if (!durationStr && order.items?.length > 0) {
    durationStr = order.items[0].rentalDuration;
  }
  const durationMonths = getMonthsFromDurationString(durationStr);
  console.log(`[Pricing Fix] Detected Duration: ${durationStr} -> ${durationMonths} Months`);

  // 4. Extract Base Rent
  let baseRent = order.productRent || 0;
  const isUpfront = order.paymentType === 'Cumulative Payment' || !order.subscriptionId;

  // Special Fallback if productRent is missing or zero
  if (!baseRent || baseRent <= 0) {
    const deposit = order.depositAmount || order.refundableDeposit || 0;
    baseRent = (order.totalAmount - deposit) / 1.18;
  }

  // 5. Normalize for Multi-Month Upfront Orders
  if (isUpfront && durationMonths > 1) {
    console.log(`[Pricing Fix] Normalizing Cumulative Payment: ${baseRent} / ${durationMonths}`);
    baseRent = baseRent / durationMonths;
  }

  const baseRate = Math.round(baseRent);
  const taxRate = Math.round(baseRate * 0.18);
  const totalRate = baseRate + taxRate;

  return {
    baseRate,
    taxRate,
    totalRate,
    currency: order.currency || 'INR',
    originalDurationMonths: durationMonths,
    paymentType: order.paymentType,
    rentalId: rental?.rentalId || 'N/A'
  };
}

/**
 * @route POST /api/payments/continue/estimate
 * @desc Get an estimation of the extension cost
 */
router.post('/estimate', verifyToken, async (req, res) => {
  console.log('HIT: POST /api/payments/continue/estimate', req.body);
  try {
    const { rentalId, orderId, extensionMonths = 1, type = 'Recurring' } = req.body;
    
    // 1. Get base monthly rate
    const rate = await calculateMonthlyRate(rentalId || orderId);
    if (!rate) {
      return res.status(404).json({ success: false, message: 'Rental or Order not found' });
    }

    // 2. Determine if there are missed payments if subId is available
    let missed = 0;
    const Rental = require('../../models/rentalProducts');
    const Subscription = require('../../models/subscription');
    
    let rental = await Rental.findOne({ 
      $or: [{ rentalId }, { orderId: orderId }] 
    });

    if (rental && rental.subscriptionId) {
      const subDoc = await Subscription.findOne({ subscriptionId: rental.subscriptionId });
      if (subDoc) {
        missed = subDoc.missedPayments || 0;
      }
    }

    // 3. For 'Full' type, return totals for the duration + missed
    if (type === 'Full') {
      const totalMonths = parseInt(extensionMonths) + missed;
      return res.json({
        success: true,
        data: {
          ...rate,
          baseRate: rate.baseRate * totalMonths,
          taxRate: rate.taxRate * totalMonths,
          totalRate: rate.totalRate * totalMonths,
          isTotal: true,
          extensionMonths: parseInt(extensionMonths),
          missedPayments: missed
        }
      });
    }

    // 4. Default to monthly rate (standard recurring behavior)
    return res.json({ 
      success: true, 
      data: { 
        ...rate, 
        isTotal: false, 
        extensionMonths: 1 
      } 
    });
  } catch (err) {
    console.error('[Estimate Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route POST /api/payments/continue
 * @desc Extend an existing rental/subscription
 */
router.post('/', verifyToken, async (req, res) => {
  console.log('HIT: POST /api/payments/continue', req.body);
  try {
    const { subscriptionId, rentalId, orderId, extensionMonths, type } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;

    if (!extensionMonths || isNaN(extensionMonths) || extensionMonths <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid extension months' });
    }

    if (!['Recurring', 'Full'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid extension type. Use Recurring or Full.' });
    }

    // 1. Find the Rental record
    let rental;
    if (rentalId) {
      rental = await Rental.findOne({ rentalId });
    } else if (orderId) {
      rental = await Rental.findOne({ orderId: orderId });
    } else if (subscriptionId) {
      rental = await Rental.findOne({ subscriptionId });
    }

    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental record not found.' });
    }

    // 2. Get normalized rate
    const rateDetails = await calculateMonthlyRate(rental.rentalId);
    if (!rateDetails) {
       return res.status(404).json({ success: false, message: 'Pricing data not found for this rental.' });
    }

    const subId = subscriptionId || rental.subscriptionId;
    let subDoc = subId ? await Subscription.findOne({ subscriptionId: subId }) : null;

    // --- RECURRING OPTION ---
    if (type === 'Recurring') {
      if (subDoc) {
        if (subDoc.status === 'created') {
          return res.status(400).json({ 
            success: false, 
            message: 'This subscription is currently in its initial setup phase (Status: Created). Recurring extensions will become available once the first billing cycle starts. To extend this rental now, please use the "Full Upfront" payment mode instead.' 
          });
        }

        if (['past_due', 'expired', 'cancelled', 'halted'].includes(subDoc.status)) {
          return res.status(400).json({ 
            success: false, 
            message: `Your subscription is currently ${subDoc.status}. Please clear any arrears (using Full Upfront mode) before extending recurring billing.` 
          });
        }

        try {
          // Update Razorpay total_count
          const rzpSub = await razorpay.subscriptions.fetch(subId);
          const currentTotalCount = rzpSub.total_count || 0;
          const newTotalCount = currentTotalCount + parseInt(extensionMonths);

          await razorpay.subscriptions.update(subId, { total_count: newTotalCount });
        } catch (rzpErr) {
          console.error('[Razorpay Update Error]:', rzpErr);
          return res.status(400).json({
            success: false,
            message: rzpErr.description || 'Razorpay rejected the extension. This usually happens if the subscription status is not Active.'
          });
        }

        // Update Local Rental Model
        rental.totalPaymentsRequired = (rental.totalPaymentsRequired || 0) + parseInt(extensionMonths);
        rental.rentedTill = addMonthsSafely(rental.rentedTill, parseInt(extensionMonths));
        await rental.save();

        return res.json({
          success: true,
          message: `Subscription successfully extended by ${extensionMonths} months. Next billing cycle remains unchanged.`,
          data: {
            rentedTill: rental.rentedTill,
            totalPaymentsRequired: rental.totalPaymentsRequired
          }
        });
      } 
      
      // CASE B: Conversion (No existing subscription) -> Create New Plan & Subscription
      else {
        const User = require('../../models/auth');
        const userDoc = await User.findById(userId).lean();
        const userName = userDoc?.username || 'Customer';
        const userEmail = userDoc?.email || 'no-email@rentbuddy.in';
        const userPhone = userDoc?.phone || '';

        const cycles = parseInt(extensionMonths);
        if (cycles === 1) {
          return res.status(400).json({ 
            success: false, 
            message: 'For a 1-month extension, please use the "Full Upfront" payment mode.' 
          });
        }

        // Use unified rateDetails
        const monthlyRecurringPaise = rateDetails.totalRate * 100;

        // Create Razorpay Plan
        const planPayload = {
          period: "monthly",
          interval: 1,
          item: {
            name: `EXT-PLAN-${rental.rentalId}-${Date.now()}`,
            amount: monthlyRecurringPaise,
            currency: rateDetails.currency,
          },
        };
        const createdPlan = await razorpay.plans.create(planPayload);

        // Start relative to currently rentedTill
        const startAtDate = addMonthsSafely(rental.rentedTill, 1);
        const startAtSeconds = Math.floor(startAtDate.getTime() / 1000);

        const subscriptionPayload = {
          plan_id: createdPlan.id,
          total_count: cycles - 1,
          quantity: 1,
          start_at: startAtSeconds,
          notes: {
            type: 'extension_conversion',
            rentalId: String(rental.rentalId),
            customerName: String(userName || 'Customer'),
            customerEmail: String(userEmail || ''),
            customerPhone: String(userPhone || ''),
            originalSubscriptionId: String(subId || 'none'),
            userId: String(userId)
          },
        };

        const newSubscription = await razorpay.subscriptions.create(subscriptionPayload);

        // Save new Subscription doc
        await Subscription.create({
          subscriptionId: newSubscription.id,
          orderId: rental.orderId, // ID from rental
          userId: userId,
          planId: createdPlan.id,
          planAmount: monthlyRecurringPaise,
          currency: rateDetails.currency,
          status: "created",
          startAt: startAtDate,
          nextChargeAt: startAtDate,
          shortUrl: newSubscription.short_url,
          notes: newSubscription.notes
        });

        // Create Initial Order for Month 1 (Commitment)
        const initialOrder = await razorpay.orders.create({
          amount: monthlyRecurringPaise,
          currency: rateDetails.currency,
          receipt: `ext_init_${rental.rentalId}_${Date.now()}`,
          notes: {
            type: 'extension',
            conversionSubscriptionId: newSubscription.id,
            rentalId: rental.rentalId,
            customerName: userName,
            customerEmail: userEmail,
            customerPhone: userPhone,
            extensionMonths: String(cycles),
            isRecurring: "true",
            userId: String(userId)
          }
        });

        return res.json({
          success: true,
          message: 'Conversion initiated. Pay for first month extension.',
          data: {
            subscriptionId: newSubscription.id,
            authLink: newSubscription.short_url,
            razorpayOrder: initialOrder,
            totalExtensionMonths: cycles
          }
        });
      }
    } 

    // --- FULL UPFRONT OPTION ---
    else if (type === 'Full') {
      const missed = subDoc ? (subDoc.missedPayments || 0) : 0;
      const totalMonthsToPay = parseInt(extensionMonths) + missed;
      
      const totalAmountRupees = totalMonthsToPay * rateDetails.totalRate;

      if (totalAmountRupees <= 0) {
         return res.status(400).json({ success: false, message: 'Calculated amount is zero. Cannot proceed.' });
      }

      // Create Razorpay Checkout Order
      const User = require('../../models/auth');
      const userDoc = await User.findById(userId).lean();

      const rzpOrder = await razorpay.orders.create({
        amount: Math.round(totalAmountRupees * 100),
        currency: rateDetails.currency,
        receipt: `ext_${rental.rentalId}_${Date.now()}`,
          notes: {
            type: 'extension',
            rentalId: String(rental.rentalId),
            customerName: String(userDoc?.username || 'Customer'),
            customerEmail: String(userDoc?.email || ''),
            customerPhone: String(userDoc?.phone || ''),
            extensionMonths: String(extensionMonths),
            missedPaymentsPaid: String(missed || 0),
            userId: String(userId)
          }
      });

      console.log('[Extension Checkout] Razorpay Order Created:', rzpOrder.id);

      return res.json({
        success: true,
        message: missed > 0 
          ? `Checkout for ${extensionMonths} months + ${missed} missed.`
          : `Checkout for ${extensionMonths} months.`,
        data: {
          order_id: rzpOrder.id,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          extensionMonths: extensionMonths,
          arrearsCleared: missed
        }
      });
    }

  } catch (err) {
    console.error('[Continue Subscription Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'An internal error occurred while processing your request.'
    });
  }
});

module.exports = router;
