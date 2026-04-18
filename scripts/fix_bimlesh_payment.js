const mongoose = require('mongoose');
const Payment = require('../models/payment');
const Rental = require('../models/rentalProducts');
const Subscription = require('../models/subscription');
const dotenv = require('dotenv');

dotenv.config();

async function fixBimleshPayment() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to DB');

        const transactionId = 'MANUAL-1775212480133';
        
        // 1. Update Payment Record
        const payment = await Payment.findOne({ transactionId });
        if (!payment) {
            console.error(`Payment ${transactionId} not found`);
            return;
        }

        console.log(`Original forMonth: ${payment.forMonth}`);
        
        // Change to March 1st, 2026
        payment.forMonth = new Date('2026-03-01T05:30:00.000Z');
        await payment.save();
        console.log(`Updated forMonth: ${payment.forMonth}`);

        // 2. Find User to find related records
        const User = require('../models/auth');
        const user = await User.findOne({ email: 'bimlesh.singh822@gmail.com' });
        if (!user) {
            console.error('User not found by email');
            return;
        }

        // 3. Verify and Sync Rental
        const rentals = await Rental.find({ userId: user._id });
        console.log(`Checking ${rentals.length} rentals for User ${user._id}...`);
        for (const rental of rentals) {
            console.log(`Rental ${rental.rentalId}: paymentsMade=${rental.paymentsMade}, nextBillingDate=${rental.nextBillingDate}`);
            // No changes needed if dates/counts match our analysis
        }

        // 4. Clean Subscription
        const sub = await Subscription.findOne({ userId: user._id });
        if (sub) {
            console.log(`Subscription ${sub.subscriptionId}: status=${sub.status}, missedPayments=${sub.missedPayments}`);
            sub.missedPayments = 0;
            sub.status = 'active';
            sub.notifiedOnFailure = false;
            await sub.save();
            console.log('Subscription cleaned and set to active.');
        }

        // 5. Backfill userId in Payment if missing
        if (!payment.userId) {
            payment.userId = user._id;
            await payment.save();
            console.log('Backfilled userId in payment record.');
        }

        console.log('Fix completed successfully.');

    } catch (err) {
        console.error('Error during fix:', err);
    } finally {
        await mongoose.disconnect();
    }
}

fixBimleshPayment();
