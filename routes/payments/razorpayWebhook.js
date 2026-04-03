// routes/payments/razorpayWebhook.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Payment = require('../../models/payment');
const Order = require('../../models/orders');
const Subscription = require('../../models/subscription');
const { fulfilOrderAfterPayment } = require('../../services/fulfilment.service');
const Invoice = require('../../models/invoice');
const razorpay = require('../../services/razorpayClient');
require('dotenv').config();

const { GRACE_DAYS } = require('../../utils/subscriptionStatusHelper');

function deriveInvoiceId(p) {
  if (!p) return `inv-${Date.now()}`;
  return (
    p.invoice_id ||
    p.notes?.invoiceId ||
    p.notes?.invoice_id ||
    p.receipt ||
    p.order_id ||
    `inv-${Date.now()}`
  );
}
function deriveOrderId(p) {
  if (!p) return 'unknown';
  return (
    p.notes?.orderId ||
    p.notes?.order_id ||
    p.order_id ||
    p.receipt ||
    'unknown'
  );
}
function computeGraceUntil(nextChargeAt) {
  const base = nextChargeAt ? new Date(nextChargeAt) : new Date();
  base.setDate(base.getDate() + GRACE_DAYS);
  return base;
}

// Helper function to add months safely
function addMonthsSafely(date, months) {
  const result = new Date(date);
  const expectedMonth = (result.getMonth() + months) % 12;
  result.setMonth(result.getMonth() + months);
  if (result.getMonth() !== expectedMonth) {
    result.setDate(0);
  }
  return result;
}

// Helper to sync Subscription and Rental dates
async function syncSubscriptionAndRentalDates(subDoc, nextChargeAt) {
  if (!subDoc) return;
  
  if (nextChargeAt) {
    subDoc.nextChargeAt = nextChargeAt;
  } else {
    // Manual advancement if no date provided from gateway
    subDoc.nextChargeAt = addMonthsSafely(subDoc.nextChargeAt || new Date(), 1);
  }
  
  subDoc.status = 'active';
  subDoc.missedPayments = 0;
  subDoc.graceUntil = null;
  subDoc.lastPaymentAt = new Date();

  // Reset all notification flags for the new cycle
  subDoc.notifiedDue = false;
  subDoc.notifiedGrace = false;
  subDoc.notifiedStrict = false;
  subDoc.notifiedOnFailure = false;
  subDoc.notifiedOnExpiry = false;

  // 🛡️ Clear stale fallback links for the new cycle
  subDoc.oneTimePaymentLink = null;
  subDoc.oneTimePaymentLinkId = null;

  await subDoc.save();

  // Sync related rentals
  try {
    const rentals = await Rental.find({ subscriptionId: subDoc.subscriptionId });
    for (const rental of rentals) {
      rental.nextBillingDate = subDoc.nextChargeAt;
      rental.paymentsMade = (rental.paymentsMade || 0) + 1;
      if (rental.paymentsMade >= (rental.totalPaymentsRequired || 0)) {
        rental.rentalStatus = 'completed';
        rental.subscriptionStatus = 'completed';
      }
      await rental.save();
    }
  } catch (err) {
    console.error("[Webhook Sync] Rental sync failed:", err);
  }
}

const Rental = require('../../models/rentalProducts');

// Webhook Route
router.post('/', async (req, res) => {
  try {
    const payloadBuffer =
      req.rawBody && req.rawBody.length
        ? req.rawBody
        : Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(JSON.stringify(req.body || {}));

    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!signature || !secret)
      return res
        .status(400)
        .json({ ok: false, message: 'Webhook misconfigured' });

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payloadBuffer)
      .digest('hex');
    if (signature !== expected)
      return res
        .status(400)
        .json({ ok: false, message: 'Invalid signature' });

    const event = JSON.parse(payloadBuffer.toString('utf8'));
    const type = event.event;
    const payload = event.payload || {};

    console.log('[WEBHOOK RECEIVED] =>', type);

    /* ======================= ONE-TIME PAYMENT SUCCESS ======================= */
    if (type === 'payment.captured' || type === 'payment.authorized') {
      const p = payload.payment?.entity;
      if (p) {
        const amount = (p.amount || 0) / 100;

        const exists = await Payment.findOne({ transactionId: p.id }).lean();
        let newPaymentId = null;
        if (!exists) {
          const orderForUser = await Order.findOne({ 
            $or: [{ orderId: deriveOrderId(p) }, { razorpayOrderId: p.order_id }] 
          }).lean();

          const newPay = await Payment.create({
            paymentId: p.id,
            userId: orderForUser?.userId,
            orderId: deriveOrderId(p),
            invoiceId: deriveInvoiceId(p),
            customerName: p.notes?.customerName || p.email || '',
            paymentMethod: p.method || 'razorpay',
            paymentStatus: 'Success',
            transactionId: p.id,
            paymentType: 'Cumulative Payment',
            amount: String(amount),
            razorpayOrderId: p.order_id,
            razorpayPaymentId: p.id,
          });
          newPaymentId = newPay._id;
        } else {
          newPaymentId = exists._id;
        }

        const noteOrder = p.notes?.orderId || p.notes?.order_id;
        if (noteOrder) {
          await Order.findOneAndUpdate(
            { orderId: noteOrder },
            { 
              paymentStatus: 'Paid', 
              status: 'Completed',
              $addToSet: { paymentIds: newPaymentId }
            }
          );
          // 🚀 Trigger fulfilment from webhook to be safe
          await fulfilOrderAfterPayment(noteOrder);
        } else if (p.order_id) {
          await Order.findOneAndUpdate(
            { razorpayOrderId: p.order_id },
            { 
              paymentStatus: 'Paid', 
              status: 'Completed',
              $addToSet: { paymentIds: newPaymentId }
            }
          );
          // 🚀 Trigger fulfilment from webhook to be safe
          await fulfilOrderAfterPayment(p.order_id);
        }

        // 🏆 Fulfilment and order update handled above with $addToSet
      }
    }

    /* ======================= FALLBACK PAYMENT LINK SUCCESS ======================= */
    if (type === 'payment_link.paid') {
      const pl = payload.payment_link?.entity;
      const p = payload.payment?.entity;
      if (pl && p) {
        const amount = (p.amount || 0) / 100;
        const noteOrder = pl.notes?.orderId || pl.notes?.order_id;

        const exists = await Payment.findOne({ transactionId: p.id }).lean();
        let newPaymentId = null;
        if (!exists) {
          // Find user from orderInternalId or related order
          const relatedOrder = await Order.findOne({
            $or: [
              { _id: pl.notes?.orderInternalId },
              { orderId: pl.notes?.orderId || pl.notes?.order_id }
            ].filter(q => Object.values(q)[0])
          }).lean();

          const newPay = await Payment.create({
            paymentId: p.id,
            userId: relatedOrder?.userId,
            orderId: noteOrder || deriveOrderId(p),
            invoiceId: deriveInvoiceId(p),
            customerName: p.notes?.customerName || p.email || '',
            paymentMethod: p.method || 'razorpay',
            paymentStatus: 'Success',
            transactionId: p.id,
            paymentType: p.subscription ? 'Recurring Payment' : 'Cumulative Payment',
            amount: String(amount),
            razorpayOrderId: p.order_id,
            razorpayPaymentId: p.id,
          });
          newPaymentId = newPay._id;
        } else {
          newPaymentId = exists._id;
        }

        if (noteOrder) {
          await Order.findOneAndUpdate(
            { orderId: noteOrder },
            { 
              paymentStatus: 'Paid', 
              status: 'Completed',
              $addToSet: { paymentIds: newPaymentId }
            }
          );
        }

        // 🔗 Robust Subscription Lookup
        if (pl.notes?.orderInternalId || pl.notes?.subscriptionId || pl.notes?.orderId) {
          const subDoc = await Subscription.findOne({
            $or: [
              { orderInternalId: pl.notes.orderInternalId },
              { subscriptionId: pl.notes.subscriptionId },
              { orderId: pl.notes.orderId }
            ].filter(q => Object.values(q)[0]) // Filter out undefined/null
          });

          if (subDoc) {
             await syncSubscriptionAndRentalDates(subDoc);
             console.log(`[Webhook] Advanced Subscription & Rentals via Payment Link Success: ${subDoc.subscriptionId}`);
          }
        }
      }
    }

    /* ======================= SUBSCRIPTION CREATE/UPDATE ======================= */
    if (
      ['subscription.created', 'subscription.activated', 'subscription.updated'].includes(
        type
      )
    ) {
      const sub = payload.subscription?.entity;
      if (sub) {
        const nextChargeAt = sub.next_charge_at
          ? new Date(sub.next_charge_at * 1000)
          : null;
        const startAt = sub.start_at ? new Date(sub.start_at * 1000) : null;

        await Subscription.findOneAndUpdate(
          { subscriptionId: sub.id },
          {
            $set: {
              subscriptionId: sub.id,
              status: sub.status === 'active' ? 'active' : sub.status,
              planId: sub.plan_id,
              planAmount: sub.plan?.item?.amount,
              currency: sub.plan?.item?.currency || 'INR',
              mandateId: sub.mandate_id,
              nextChargeAt,
              startAt,
              shortUrl: sub.short_url || sub.shortUrl,
              raw: sub,
              ...(sub.status === 'active'
                ? {
                  graceUntil: null,
                  missedPayments: 0,
                  notifiedOnFailure: false,
                  // 🛡️ Clear stale fallback links on activation/success
                  oneTimePaymentLink: null,
                  oneTimePaymentLinkId: null,
                }
                : {}),
            },
          },
          { upsert: true }
        );

        if (sub.status === 'active' && sub.notes?.orderId) {
          await Order.findOneAndUpdate(
            { orderId: sub.notes.orderId },
            { paymentStatus: 'Active', status: 'Processing' }
          );
        }
      }
    }

    /* ======================= RECURRING PAYMENT SUCCESS ======================= */
    if (['subscription.charged', 'subscription.payment_succeeded'].includes(type)) {
      const payment = payload.payment?.entity;
      const subscriptionEntity = payload.subscription?.entity;

      if (payment) {
        const amount = (payment.amount || 0) / 100;

        const paymentDate = payment.created_at
          ? new Date(payment.created_at * 1000)
          : new Date();

        // 👇 month bucket for this charge
        const forMonth = new Date(
          paymentDate.getFullYear(),
          paymentDate.getMonth(),
          1
        );

        const exists = await Payment.findOne({
          transactionId: payment.id,
        }).lean();

        let newPaymentDoc = null;
        if (!exists) {
          // Find original order to get userId
          const originalOrder = await Order.findOne({ 
            $or: [
              { subscriptionId: payment.subscription },
              { orderId: deriveOrderId(payment) }
            ]
          }).lean();

          newPaymentDoc = await Payment.create({
            paymentId: payment.id,
            userId: originalOrder?.userId,
            orderId: deriveOrderId(payment),
            invoiceId: deriveInvoiceId(payment),
            customerName: payment.notes?.customerName || payment.email || '',
            paymentMethod: payment.method || 'razorpay',
            paymentStatus: 'Success',
            transactionId: payment.id,
            paymentType: 'Recurring Payment',
            amount: String(amount),
            razorpayOrderId: payment.order_id,
            razorpayPaymentId: payment.id,
            razorpaySubscriptionId: payment.subscription,
            paymentDate,
            forMonth, // 🔥 used to check "paid for this month?"
          });

          // Link Payment to Order
          if (originalOrder) {
            await Order.findByIdAndUpdate(originalOrder._id, {
              $addToSet: { paymentIds: newPaymentDoc._id }
            });
          }
        } else {
          newPaymentDoc = exists;
        }

        // 📝 RECURRING INVOICE GENERATION
        try {
          // Find original order to get items & billing
          const originalOrder = await Order.findOne({ 
            $or: [
              { subscriptionId: payment.subscription },
              { orderId: deriveOrderId(payment) }
            ]
          }).lean();

          if (originalOrder) {
             const userEmail = originalOrder.billingInfo?.email || payment.email || originalOrder.userId?.email || "no-email@provided.com";

             // Sanitize items for Invoice schema
             const invoiceItems = (originalOrder.items || []).map(item => ({
                itemType: item.itemType || 'product',
                productId: item.productId,
                packageId: item.packageId,
                quantity: item.quantity,
                price: item.price || item.rent,
                productSerialId: item.productSerialId,
                serialNumber: item.serialNumber,
                rentalDuration: item.rentalDuration,
                productName: item.productName
             }));

             const recurringInvoice = new Invoice({
                userId: originalOrder.userId,
                userEmail: userEmail,
                billingInfo: originalOrder.billingInfo,
                items: invoiceItems,
                totalAmount: amount, // Current charge amount
                depositAmount: 0,    // No deposit on recurring charges
                paymentType: 'Recurring Payment',
                paymentMethod: payment.method || 'razorpay',
                orderId: originalOrder.orderId,
                orderInternalId: originalOrder._id
             });
             await recurringInvoice.save();
             
             // Link Invoice to Payment
             if (newPaymentDoc) {
                await Payment.findByIdAndUpdate(newPaymentDoc._id, {
                   invoiceId: recurringInvoice._id
                });
             }
             console.log(`[Webhook] Created recurring invoice ${recurringInvoice.invoice_number} for sub ${payment.subscription}`);
          }
        } catch (invErr) {
          console.error('[Webhook] Failed to create recurring invoice:', invErr);
        }

        // AUTO REACTIVATE SUBSCRIPTION
        const subDoc = await Subscription.findOne({
          subscriptionId: payment.subscription,
        });
        const nextChargeAt = subscriptionEntity?.next_charge_at
          ? new Date(subscriptionEntity.next_charge_at * 1000)
          : null;

        if (subDoc) {
          await syncSubscriptionAndRentalDates(subDoc, nextChargeAt);
          console.log('🚀 Subscription and Rentals advanced after successful automatic charge');
        }
      }
    }

    /* ======================= PAYMENT FAILED ======================= */
    if (
      [
        'invoice.payment_failed',
        'payment.failed',
        'subscription.charged.failed',
      ].includes(type)
    ) {
      const pay = payload.payment?.entity;
      const subId =
        pay?.subscription ||
        payload.invoice?.entity?.subscription_id ||
        payload.subscription?.entity?.id;

      if (pay) {
        const paymentDate = pay.created_at
          ? new Date(pay.created_at * 1000)
          : new Date();
        const forMonth = new Date(
          paymentDate.getFullYear(),
          paymentDate.getMonth(),
          1
        );

        const exists = await Payment.findOne({
          transactionId: pay.id,
        }).lean();
        if (!exists) {
          await Payment.create({
            paymentId: pay.id,
            orderId: deriveOrderId(pay),
            invoiceId: deriveInvoiceId(pay),
            customerName: pay.notes?.customerName || pay.email || '',
            paymentMethod: pay.method || 'razorpay',
            paymentStatus: 'Failed',
            transactionId: pay.id,
            paymentType: 'Recurring Payment',
            amount: String((pay.amount || 0) / 100),
            razorpayOrderId: pay.order_id,
            razorpayPaymentId: pay.id,
            razorpaySubscriptionId: pay.subscription,
            paymentDate,
            forMonth,
          });
        }
      }

      if (subId) {
        const subDoc = await Subscription.findOne({
          subscriptionId: subId,
        });
        if (subDoc) {
          subDoc.status = 'past_due';
          subDoc.missedPayments += 1;
          subDoc.graceUntil = computeGraceUntil(
            subDoc.nextChargeAt || new Date()
          );

          if (!subDoc.notifiedOnFailure) {
            subDoc.notifiedOnFailure = true; // place to send SMS/email if you want
          }

          await subDoc.save();
          console.log('⚠ Subscription marked PAST_DUE and grace started');

          // 🛡️ GENERATE NEW FALLBACK PAYMENT LINK ON FAILURE
          try {
            const plink = await razorpay.paymentLink.create({
              amount: subDoc.planAmount, // in paise
              currency: subDoc.currency || "INR",
              accept_partial: false,
              description: `Monthly payment for Subscription ${subDoc.subscriptionId} (Fallback)`,
              customer: {
                name: subDoc.userId?.name || "Customer",
                email: subDoc.userId?.email || "no-email@rentbuddy.in",
                contact: subDoc.userId?.phone,
              },
              notify: { sms: false, email: false },
              reminder_enable: false,
              notes: {
                subscriptionId: subDoc.subscriptionId,
                orderId: subDoc.orderId,
                orderInternalId: subDoc.orderInternalId?.toString(),
                type: "fallback_recurring",
              },
            });
            subDoc.oneTimePaymentLink = plink.short_url;
            subDoc.oneTimePaymentLinkId = plink.id;
            await subDoc.save();
            console.log(`[Webhook] Generated new fallback link for failed sub: ${plink.short_url}`);
          } catch (plErr) {
            console.error("Fallback Link generation failed after charge failure:", plErr);
          }
        }
      }
    }

    /* ======================= SUBSCRIPTION CANCELLED/HALTED ======================= */
    if (['subscription.cancelled', 'subscription.halted'].includes(type)) {
      const sub = payload.subscription?.entity;
      if (sub) {
        const subDoc = await Subscription.findOne({ subscriptionId: sub.id }).populate('userId');
        if (subDoc) {
          subDoc.status = sub.status;
          subDoc.mandateStatus = 'cancelled';
          
          // Generate fallback link since mandate is gone
          try {
            const plink = await razorpay.paymentLink.create({
              amount: subDoc.planAmount,
              currency: subDoc.currency || "INR",
              description: `Payment for cancelled mandate - Sub ${sub.id}`,
              customer: {
                name: subDoc.userId?.name || "Customer",
                email: subDoc.userId?.email || "no-email@rentbuddy.in",
                contact: subDoc.userId?.phone,
              },
              notes: {
                subscriptionId: sub.id,
                type: "mandate_cancelled_fallback"
              }
            });
            subDoc.oneTimePaymentLink = plink.short_url;
            subDoc.oneTimePaymentLinkId = plink.id;
          } catch (plErr) {
            console.error("Link generation on cancellation failed:", plErr);
          }
          await subDoc.save();
        }
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ ok: false, error: err.message });
  }
});

module.exports = router;
