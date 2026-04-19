const mongoose = require('mongoose');
const Payment = require('../models/payment');
const Rental = require('../models/rentalProducts');
const Subscription = require('../models/subscription');
const User = require('../models/auth');
const dotenv = require('dotenv');

dotenv.config();

async function fixBrisePayment() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to DB');

        const email = 'brise.management@gmail.com';
        const transactionId = 'MANUAL-SKIP-1776511992556';
        const targetSubscriptionId = 'sub_SK8KBx9xa26oVu';
        const rentalId = '554030';

        const user = await User.findOne({ email });
        if (!user) {
            console.error('User not found by email');
            return;
        }

        // 1. Update Payment Record
        const payment = await Payment.findOne({ transactionId });
        if (payment) {
            console.log(`Original forMonth: ${payment.forMonth}`);
            // Change to March 1st, 2026
            payment.forMonth = new Date('2026-03-01T05:30:00.000Z');
            payment.userId = user._id; // Ensure userId is linked
            await payment.save();
            console.log(`Updated forMonth: ${payment.forMonth}`);
        } else {
            console.error(`Payment ${transactionId} not found`);
        }

        // 2. Update Rental Record
        const rental = await Rental.findOne({ rentalId: rentalId });
        if (rental) {
            console.log(`Original Rental: paymentsMade=${rental.paymentsMade}, nextBillingDate=${rental.nextBillingDate}`);
            rental.paymentsMade = 2;
            rental.nextBillingDate = new Date('2026-04-25T10:00:00.000Z');
            await rental.save();
            console.log(`Updated Rental: paymentsMade=${rental.paymentsMade}, nextBillingDate=${rental.nextBillingDate}`);
        } else {
            console.error(`Rental ${rentalId} not found`);
        }

        // 3. Clean Subscription
        const sub = await Subscription.findOne({ subscriptionId: targetSubscriptionId });
        if (sub) {
            console.log(`Original Subscription: status=${sub.status}, nextChargeAt=${sub.nextChargeAt}, missedPayments=${sub.missedPayments}`);
            sub.status = 'active';
            sub.missedPayments = 0;
            sub.nextChargeAt = new Date('2026-04-25T10:00:00.000Z');
            sub.notifiedOnFailure = false;
            await sub.save();
            console.log(`Updated Subscription: status=${sub.status}, nextChargeAt=${sub.nextChargeAt}`);
        } else {
            console.error(`Subscription ${targetSubscriptionId} not found`);
        }

        console.log('Fix completed successfully.');

    } catch (err) {
        console.error('Error during fix:', err);
    } finally {
        await mongoose.disconnect();
    }
}

fixBrisePayment();
