const mongoose = require('mongoose');
const Subscription = require('../models/subscription');
const Order = require('../models/orders');
require('dotenv').config();

async function inspectSample() {
    await mongoose.connect(process.env.MONGODB_URL);
    const razorpay = require('../services/razorpayClient');
    const subs = await Subscription.find({ oneTimePaymentLink: { $exists: true, $ne: null } }).limit(5).populate('orderInternalId');
    for (const sub of subs) {
        console.log(`Sub: ${sub.subscriptionId}`);
        console.log(`  Plan Amount: ${sub.planAmount}`);
        console.log(`  Link ID: ${sub.oneTimePaymentLinkId}`);
        console.log(`  Link URL: ${sub.oneTimePaymentLink}`);
        
        try {
            const plink = await razorpay.paymentLink.fetch(sub.oneTimePaymentLinkId);
            console.log(`  Razorpay Link Amount: ${plink.amount}`);
        } catch (err) {
            console.log(`  Razorpay Fetch Error: ${err.message || err}`);
        }
    }
    process.exit(0);
}
inspectSample();
