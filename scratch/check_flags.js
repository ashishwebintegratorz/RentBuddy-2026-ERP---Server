
const mongoose = require('mongoose');
require('dotenv').config();
const Subscription = require('../models/subscription');
const User = require('../models/auth');

async function checkFlags(email) {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        const user = await User.findOne({ email });
        if (!user) return console.log('User not found');
        const sub = await Subscription.findOne({ userId: user._id });
        if (!sub) return console.log('Sub not found');
        
        console.log('Notification Flags for', email);
        console.log({
            subscriptionId: sub.subscriptionId,
            notifiedDue: sub.notifiedDue,
            notifiedGrace: sub.notifiedGrace,
            notifiedGraceFinal: sub.notifiedGraceFinal,
            notifiedStrict: sub.notifiedStrict,
            notifiedTwoDaysBefore: sub.notifiedTwoDaysBefore,
            lastNotifiedCycle: sub.lastNotifiedCycle
        });
    } catch (err) { console.error(err); }
    finally { mongoose.disconnect(); }
}
checkFlags('abhishek7000461442@gmail.com');
