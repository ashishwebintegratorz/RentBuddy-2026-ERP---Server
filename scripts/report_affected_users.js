const mongoose = require('mongoose');
const Subscription = require('../models/subscription');
const User = require('../models/auth');
require('dotenv').config();

async function findPotentialAffectedUsers() {
    await mongoose.connect(process.env.MONGODB_URL);
    
    // Subscriptions with a link but never notified for a cycle (still using initial link)
    const affectedSubs = await Subscription.find({
        oneTimePaymentLink: { $exists: true, $ne: null },
        lastNotifiedCycle: { $exists: false }
    }).populate('userId');

    console.log(`\n--- Potential Affected Users Report ---`);
    console.log(`Total found: ${affectedSubs.length}`);
    
    const report = affectedSubs.map(s => ({
        email: s.userId?.email,
        phone: s.userId?.phone,
        subId: s.subscriptionId,
        planAmount: s.planAmount / 100,
        currentLink: s.oneTimePaymentLink
    }));

    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
}

findPotentialAffectedUsers();
