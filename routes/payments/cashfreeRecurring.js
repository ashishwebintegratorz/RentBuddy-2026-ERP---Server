const express = require('express');
const router = express.Router();
const Webhook = require('../../models/webhook');
const Rental = require('../../models/rentalProducts')
const Payment = require('../../models/payment')

const dotenv = require('dotenv');
const axios = require('axios');


dotenv.config();

// Cashfree API credentials
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID_TEST;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY_TEST;
const CF_BASE_URL = 'https://sandbox.cashfree.com/pg'


router.post('/cashfree-webhook', async (req, res) => {
    try {
        const event = req.body
        await new Webhook({ payload: event }).save();

        // Handle subscription updates
        if(event.event === 'SUBSCRIPTION_UPDATED') {
            const subscriptionId = event.data.subscription_id;
            const nextChargeDate = event.data.next_charge_date;

            // Update rental with new billing date
            await Rental.updateOne(
                { subscriptionId },
                { $set: { nextBillingDate: new Date(nextChargeDate) } }
            );
        }

        // Handle manual payments
        if (event.event === 'PAYMENT_SUCCESS' && event.data.payment.payment_group === "subscription") {
            
            const subscriptionId = event.data.payment.subscription_id;
            const rental = await Rental.findOne({ subscriptionId });

            if (!rental) {
                return res.status(404).json({ message: 'Rental not found' });
            }

            // Check if this payment month is already paid manually
            const paymentMonth = new Date(event.data.payment.payment_time);
            if (rental.isMonthPaid(paymentMonth)) {
                return res.status(200).json({ message: 'Month already paid manually' });
            }

            // Record payment
            rental.paymentsMade += 1;
            rental.emiHistory.push({
                dueDate: paymentMonth,
                method: 'auto',
                status: 'success',
                transactionId: event.data.payment.cf_payment_id,
                processedAt: new Date()
            });

            // Create payment record
            const newPayment = new Payment({
                orderId: event.data.payment.order_id,
                rentalId: rental._id,
                invoiceId: rental.orderId.invoiceIds[0],
                paymentMethod: 'subscription',
                paymentType: 'Recurring Payment',
                amount: event.data.payment.amount,
                status: 'success',
                transactionId: event.data.payment.cf_payment_id,
                forMonth: paymentMonth
            });

            await newPayment.save();

            // Check if this was the final payment
            if (rental.paymentsMade === rental.totalPaymentsRequired) {
                rental.rentalStatus = 'completed';
                rental.subscriptionStatus = 'completed';
                
                // Cancel subscription
                await cashfree.cancelSubscription(subscriptionId);
            }

            await rental.save();
        }
        
        res.status(200).json({ message: 'Webhook processed' });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({
            message: 'Error processing webhook',
            error: error.message,
        });
    }
});

module.exports = router;