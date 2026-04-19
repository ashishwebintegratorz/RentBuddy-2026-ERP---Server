const mongoose = require('mongoose');
const User = require('../models/auth');
const Subscription = require('../models/subscription');
const Rental = require('../models/rentalProducts');
const Payment = require('../models/payment');
const Order = require('../models/orders');
const dotenv = require('dotenv');

dotenv.config();

async function debugCustomer(email) {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to DB');

        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found');
            return;
        }
        console.log('--- USER ---');
        console.log(`_id: ${user._id}`);
        console.log(`email: ${user.email}`);

        const subs = await Subscription.find({ userId: user._id });
        console.log('--- SUBSCRIPTIONS ---');
        subs.forEach(s => {
            console.log(`ID: ${s.subscriptionId}, Status: ${s.status}, nextChargeAt: ${s.nextChargeAt}, missedPayments: ${s.missedPayments}`);
        });

        const rentals = await Rental.find({ userId: user._id });
        console.log('--- RENTALS ---');
        rentals.forEach(r => {
            console.log(`RentalID: ${r.rentalId}, paymentsMade: ${r.paymentsMade}, nextBillingDate: ${r.nextBillingDate}, rentedDate: ${r.rentedDate}`);
        });

        const subIds = subs.map(s => s.subscriptionId);
        const orderIds = rentals.map(r => r.orderId);

        const payments = await Payment.find({
            $or: [
                { userId: user._id },
                { razorpaySubscriptionId: { $in: subIds } },
                { orderId: { $in: orderIds } }
            ]
        });
        console.log('--- PAYMENTS ---');
        payments.forEach(p => {
            console.log(`TransactionID: ${p.transactionId}, Amount: ${p.amount}, Date: ${p.paymentDate}, forMonth: ${p.forMonth}, Type: ${p.paymentType}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debugCustomer('brise.management@gmail.com');
