const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const verifyToken = require('../../middlewares/verifyToken');
const Payment = require('../../models/payment');
const Order = require('../../models/orders');
const Invoice = require('../../models/invoice');
const Subscription = require('../../models/subscription');


router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const total = await Payment.countDocuments();

    const payments = await Payment.find()
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const results = await Promise.all(
      payments.map(async (payment) => {
        let orderDoc = null;

        // Payment.orderId can be:
        //  - internal ObjectId string (from addOrder)
        //  - public orderId like 'ORD-...'
        if (payment.orderId) {
          if (mongoose.Types.ObjectId.isValid(payment.orderId)) {
            orderDoc = await Order.findById(payment.orderId)
              .populate('userId', '-password -__v')
              .populate('paymentIds')
              .populate('invoiceIds')
              .lean()
              .catch(() => null);
          }

          if (!orderDoc) {
            orderDoc = await Order.findOne({ orderId: payment.orderId })
              .populate('userId', '-password -__v')
              .populate('paymentIds')
              .populate('invoiceIds')
              .lean()
              .catch(() => null);
          }
        }

        const userDetails = orderDoc?.userId || null;

        // Invoice: prefer by orderId, fallback by invoice_number hint
        let invoiceDoc = null;
        if (orderDoc?._id) {
          invoiceDoc = await Invoice.findOne({ orderId: orderDoc._id })
            .populate('items.productId', 'productName rentalPrice deposit')
            .sort({ created_at: -1 })
            .lean()
            .catch(() => null);
        } else if (payment.invoiceId) {
          // invoiceId might be invoice_number in some flows
          invoiceDoc = await Invoice.findOne({
            invoice_number: payment.invoiceId,
          })
            .populate('items.productId', 'productName rentalPrice deposit')
            .lean()
            .catch(() => null);
        }

        // subscription from order.subscriptionId or payment.razorpaySubscriptionId
        let subscriptionDoc = null;
        if (orderDoc?.subscriptionId) {
          subscriptionDoc = await Subscription.findOne({
            subscriptionId: orderDoc.subscriptionId,
          })
            .lean()
            .catch(() => null);
        } else if (payment.razorpaySubscriptionId) {
          subscriptionDoc = await Subscription.findOne({
            subscriptionId: payment.razorpaySubscriptionId,
          })
            .lean()
            .catch(() => null);
        }

        return {
          ...payment,
          userDetails,
          orderDetails: orderDoc,
          invoiceDetails: invoiceDoc,
          subscriptionDetails: subscriptionDoc,
        };
      })
    );

    return res.json({
      success: true,
      data: results,
      total,
      count: results.length,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error while fetching payments.',
    });
  }
});

module.exports = router;
