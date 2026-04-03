const express = require('express');
const router = express.Router();
const razorpay = require('../services/razorpayClient');
const Payment = require('../models/payment');
const Order = require('../models/orders');
const Barcode = require('../models/barcode');
const Rental = require('../models/rentalProducts');
const Product = require('../models/product');
const verifyToken = require('../middlewares/verifyToken');
const sendEmail = require('../services/email.service');
const { getTemplate } = require('../utils/emailTemplates');

/**
 * @route   POST /api/refunds/create-refund
 * @desc    Process a refund via Razorpay
 * @access  Admin (via verifyToken)
 */
router.post('/create-refund', verifyToken, async (req, res) => {
    try {
        const {
            paymentId, // Internal MongoDB ID of the Payment document
            refund_amount, // Optional: amount to refund (in INR). If not provided, full refund is assumed.
            refund_note
        } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: 'paymentId is required'
            });
        }

        // 1. Fetch Payment record
        const paymentDoc = await Payment.findById(paymentId);
        if (!paymentDoc) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found'
            });
        }

        const { razorpayPaymentId, amount: originalAmount, paymentStatus } = paymentDoc;

        if (!razorpayPaymentId) {
            return res.status(400).json({
                success: false,
                message: 'This payment does not have a valid Razorpay Payment ID'
            });
        }

        if (paymentStatus !== 'Success' && paymentStatus !== 'Completed') {
            return res.status(400).json({
                success: false,
                message: 'Only successful payments can be refunded'
            });
        }

        // 2. Prepare refund payload
        const refundPayload = {
            notes: {
                reason: refund_note || 'Admin requested refund',
                internal_payment_id: paymentId.toString(),
                order_id: paymentDoc.orderId
            }
        };

        // Razorpay expects amount in paise
        if (refund_amount) {
            const amountInPaise = Math.round(Number(refund_amount) * 100);
            if (isNaN(amountInPaise) || amountInPaise <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid refund amount'
                });
            }
            refundPayload.amount = amountInPaise;
        }

        console.log(`[REFUND] Initiating Razorpay refund for payment ${razorpayPaymentId}, amount: ${refund_amount || 'Full'}`);

        // 3. Call Razorpay API
        const refundResponse = await razorpay.payments.refund(razorpayPaymentId, refundPayload);

        console.log('[REFUND] Razorpay response:', refundResponse.id);

        // 4. Update Payment document
        const currentRefunded = paymentDoc.refundAmount || 0;
        const totalRefundedNow = currentRefunded + (refund_amount ? Number(refund_amount) * 100 : Number(originalAmount));

        paymentDoc.refundAmount = totalRefundedNow;

        // Determine status based on amount
        if (totalRefundedNow >= Number(originalAmount)) {
            paymentDoc.refundStatus = 'Full';
        } else {
            paymentDoc.refundStatus = 'Partial';
        }

        paymentDoc.refundDate = new Date();
        await paymentDoc.save();

        // 5. Update Order status
        // Find order by public orderId or internal _id (Payment.orderId stores one of them)
        let orderDoc = await Order.findOne({ orderId: paymentDoc.orderId });
        if (!orderDoc && paymentDoc.orderId.length === 24) {
            orderDoc = await Order.findById(paymentDoc.orderId);
        }

        if (orderDoc) {
            orderDoc.paymentStatus = refund_amount ? 'Partially Refunded' : 'Refunded';
            if (!refund_amount) {
                orderDoc.status = 'Cancelled';

                // 🔹 Professional Cleanup: Free up barcodes and rentals for full refund
                try {
                    // 1. Terminate Subscription on Razorpay & local DB
                    const cancellationHelper = require('../utils/cancellationHelper');
                    if (orderDoc.subscriptionId) {
                        try {
                            const cancelResult = await cancellationHelper.cancelSubscription(
                                orderDoc.subscriptionId, 
                                `Full Refund for Order ${orderDoc.orderId}`,
                                true // Cancel immediately
                            );
                            console.log(`[REFUND] Subscription ${orderDoc.subscriptionId} cancelled:`, cancelResult.success ? 'Success' : 'Failed');
                        } catch (subCancelErr) {
                            console.error(`[REFUND] Fatal error cancelling subscription ${orderDoc.subscriptionId}:`, subCancelErr.message);
                        }
                    }

                    // 2. Mark barcodes as available
                    if (orderDoc.barcodeIds && orderDoc.barcodeIds.length > 0) {
                        await Barcode.updateMany(
                            { _id: { $in: orderDoc.barcodeIds } },
                            { $set: { status: 'available', currentRental: null } }
                        );
                        console.log(`[REFUND] Freed ${orderDoc.barcodeIds.length} barcodes for order ${orderDoc.orderId}`);
                    }

                    // 3. Mark rentals as cancelled
                    await Rental.updateMany(
                        { orderId: orderDoc._id },
                        { $set: { rentalStatus: 'completed', subscriptionStatus: 'cancelled', paymentStatus: 'Refunded' } }
                    );

                    // 3. Sync Stock for each product in the order
                    for (const item of orderDoc.items) {
                        if (item.productId) {
                            const availableCount = await Barcode.countDocuments({
                                "rentalItem.productID": item.productId,
                                status: "available",
                            });

                            await Product.findByIdAndUpdate(item.productId, {
                                stocks: availableCount,
                                availability: availableCount > 0 ? "available" : "out-of-stock",
                            });
                        }
                    }
                    console.log(`[REFUND] Synced stock for order ${orderDoc.orderId} products`);
                } catch (cleanupError) {
                    console.error('[REFUND] Cleanup failed (non-critical):', cleanupError);
                }
            }
            await orderDoc.save();
            console.log(`[REFUND] Updated order ${orderDoc.orderId} status to ${orderDoc.paymentStatus}`);

            // 6. Send Email Notification
            const userEmail = orderDoc.billingInfo?.email;
            const userName = orderDoc.billingInfo?.firstName || 'Valued Customer';
            const refundedAmountInINR = refundResponse.amount / 100;

            if (userEmail) {
                try {
                    const emailHtml = getTemplate('REFUND', {
                        name: userName,
                        amount: refundResponse.amount, // template divides by 100
                        status: 'Completed'
                    });

                    await sendEmail(
                        userEmail,
                        `Refund Processed - Order ${orderDoc.orderId}`,
                        `Your refund of ₹${refundedAmountInINR} for order ${orderDoc.orderId} has been processed.`,
                        emailHtml
                    );
                    console.log(`[REFUND] Notification email sent to ${userEmail}`);
                } catch (emailError) {
                    console.error('[REFUND] Failed to send notification email:', emailError);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            data: {
                refundId: refundResponse.id,
                status: refundResponse.status,
                amount: refundResponse.amount / 100
            }
        });

    } catch (error) {
        console.error('[REFUND] Error:', error);

        // Razorpay specific error handling
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.error ? error.error.description : 'Razorpay refund failed',
                code: error.error ? error.error.code : 'RAZORPAY_ERROR'
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

module.exports = router;
