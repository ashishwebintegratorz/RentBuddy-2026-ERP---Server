const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Auth = require('../models/auth');
const Subscription = require('../models/subscription');

async function checkUser(searchName) {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        
        // 1. Search in Auth by username
        let user = await Auth.findOne({ username: { $regex: searchName, $options: 'i' } });
        
        // 2. If not found, search in Subscription notes or raw data
        let sub = null;
        if (user) {
            console.log(`✅ User Found in Auth: ${user.username} (${user.email})`);
            sub = await Subscription.findOne({ userId: user._id });
        } else {
            console.log(`🔍 User not found in Auth by username. Searching Subscriptions directly...`);
            sub = await Subscription.findOne({ 
                $or: [
                    { "raw.customer.name": { $regex: searchName, $options: 'i' } },
                    { "notes.customerName": { $regex: searchName, $options: 'i' } }
                ]
            });
            if (sub) {
                console.log(`✅ Subscription found by matching name in notes/raw data!`);
                user = await Auth.findById(sub.userId);
                if (user) console.log(`Associated User: ${user.username} (${user.email})`);
            }
        }

        if (!user && !sub) {
            console.log(`❌ No user or subscription found matching "${searchName}"`);
            process.exit(0);
        }
        if (!sub) {
            console.log(`❌ No subscription found for user ${user.name}`);
        } else {
            console.log(`✅ Subscription Found: ${sub.subscriptionId}`);
            console.log(`Status: ${sub.status}`);
            console.log(`Next Charge: ${sub.nextChargeAt}`);
            console.log(`Last Payment At: ${sub.lastPaymentAt}`);
            console.log(`Current oneTimePaymentLink: ${sub.oneTimePaymentLink || "NONE"}`);

            if (sub.oneTimePaymentLink) {
                console.log(`\n🧹 Clearing stale payment link for ${user.name}...`);
                sub.oneTimePaymentLink = null;
                sub.oneTimePaymentLinkId = null;
                await sub.save();
                console.log(`✅ Done. Link cleared.`);
            } else {
                console.log(`\nNothing to clear. Link is already empty.`);
            }
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("Error checking user:", err);
        process.exit(1);
    }
}

const nameArg = process.argv.slice(2).join(' ') || 'Ashwin singh chandel';
checkUser(nameArg);
