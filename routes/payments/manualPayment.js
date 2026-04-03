const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const router = express.Router();
const Rental = require('../../models/rentalProducts');
const Order = require('../../models/orders')
const Payment = require('../../models/payment')
const mongoose = require('mongoose')
const dotenv = require('dotenv');
const axios = require('axios');


dotenv.config();

// Cashfree API credentials
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID_TEST;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY_TEST;
const CF_BASE_URL = 'https://sandbox.cashfree.com/pg'
const SUBSCRIPTION_URL = 'https://sandbox.cashfree.com/api/v2/subscriptions';

// Helper function to get cashfree headers
const getCashfreeHeaders = () => {
    return {
        'x-api-version': '2025-01-01',
        'X-Client-Id': CASHFREE_APP_ID,
        'X-Client-Secret': CASHFREE_SECRET_KEY,
        'Content-Type' : 'application/json'
    }
}


// Helper function to add months to a date safely
function addMonthsSafely(date, months) {
  const result = new Date(date);
  const expectedMonth = (result.getMonth() + months) % 12;
  result.setMonth(result.getMonth() + months);
  
  // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28/29)
  if (result.getMonth() !== expectedMonth) {
    result.setDate(0); // Set to last day of previous month
  }
  
  return result;
}


// Helper function to format date to YYYY-MM-DD
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}


router.post('/', verifyToken, async(req, res) => {
    try {
        const { rentalId, amount } = req.body;
        const { userId } = req.user;

        // 1. Verify rental and get subscription details
        const rental = await Rental.findOne({_id: rentalId, userId})
            .populate('productId')
            .populate('orderId');

        if (!rental) { return res.status(404).json({ message: "Rental not found" })}

        // 2. Check if rental is already completed
        if (rental.rentalStatus === 'completed') {
            return res.status(400).json({ message: "Rental is already completed" });
        }
 
        // 3. Validate payment amount (rent + 18% tax)
        const expectedAmount = (rental.productId.rentalPrice * 1.18).toFixed(2);
        if (parseFloat(amount) !== parseFloat(expectedAmount)) {
        return res.status(400).json({
            message: `Payment amount must be ₹${expectedAmount} (rent + tax)`,
            expectedAmount
        });
        }

        // Check if all payments are already made
        if (rental.paymentsMade >= rental.totalPaymentsRequired) {
            return res.status(400).json({ error: "All payments already completed" });
        }

        // 4. Calculate next billing date after skipping one month
        const billingDay = parseInt(rental.emiDate.match(/\d+/)[0]);
        const today = new Date();
        let nextBillingDate = new Date(today);
        nextBillingDate.setDate(billingDay)

        if (today.getDate() >= billingDay) {
            nextBillingDate = addMonthsSafely(nextBillingDate, 1);
        }

        // Adjust for months with fewer days
        const lastDay = new Date(
            nextBillingDate.getFullYear(),
            nextBillingDate.getMonth() + 1,
            0
        ).getDate();
        
        if (billingDay > lastDay) {
            nextBillingDate.setDate(lastDay);
        }

        const formattedDate = formatDate(nextBillingDate);

        

        // 5. Update subscription next charge date
        if(rental.subscriptionId &&  rental.subscriptionStatus === 'active' && rental.paymentsMade < rental.totalPaymentsRequired) {
            try {
                const nextUnpaidMonth = new Date(rental.rentStartDate);
                nextUnpaidMonth.setMonth(nextUnpaidMonth.getMonth() + rental.paymentsMade);
                nextUnpaidMonth.setDate(rental.originalBillingDay);

                // Update subscription to skip the paid month
                await cashfree.updateSubscription(rental.subscriptionId, {
                    next_charge_date: nextUnpaidMonth.toISOString().split('T')[0]
                });
            } catch (error) {
                console.error('Error Updating subscription:', error);
                throw new Error('Failed to update subscription');
            }
        }

        // 6. Process payment (simulated)
        const transactionId = `txn_${Date.now()}`;
        const paymentMonth = await rental.recordManualPayment(transactionId);

        // 7. Create payment record
        const newPayment = new Payment({
            orderId: `MANUAL-${Date.now()}`,
            rentalId: rental._id,
            invoiceId: rental.orderId.invoiceIds[0],
            paymentMethod: 'manual',
            paymentType: 'Recurring Payment',
            amount: amount,
            status: 'success',
            transactionId: transactionId,
            forMonth: paymentMonth
        });

        await newPayment.save();

        // // 7. Update rental record
        // rental.paymentsMade += 1;
        // rental.paymentHistory.push({
        //     date: new Date(),
        //     amount: amount,
        //     method: 'manual',
        //     transactionId: newPayment.transactionId,
        //     isEarlyPayment: true,
        //     forMonth: new Date()
        // });
        
        rental.nextBillingDate = nextBillingDate;
        await rental.save();

        
        // If this was the final payment
        if (rental.paymentsMade === rental.totalPaymentsRequired) {
            // Cancel subscription if exists
            if (rental.subscriptionId) {
                await cashfree.cancelSubscription(rental.subscriptionId);
            }

            res.json({
                message: "Manual payment recorded",
                paymentsMade: rental.paymentsMade,
                remainingPayments: rental.totalPaymentsRequired - rental.paymentsMade,
                nextAutoPaymentDate: rental.nextBillingDate
            });

        }
    }catch(error){
        console.error("Manual payment error:", error);
        res.status(500).json({ 
            message: error.response?.data?.message || "Payment processing failed",
            error: error.message 
        });
    }
});

module.exports = router;
