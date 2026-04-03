const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Subscription = require('../models/subscription');

async function bulkClearLinks() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Connected.");

        // Find all subscriptions that have a oneTimePaymentLink
        const subsToUpdate = await Subscription.find({ 
            $or: [
                { oneTimePaymentLink: { $exists: true, $ne: null } },
                { oneTimePaymentLinkId: { $exists: true, $ne: null } }
            ]
        });

        console.log(`🔍 Found ${subsToUpdate.length} subscriptions with potentially stale links.`);

        if (subsToUpdate.length > 0) {
            const result = await Subscription.updateMany(
                { 
                    $or: [
                        { oneTimePaymentLink: { $exists: true, $ne: null } },
                        { oneTimePaymentLinkId: { $exists: true, $ne: null } }
                    ]
                },
                { 
                    $set: { 
                        oneTimePaymentLink: null,
                        oneTimePaymentLinkId: null
                    } 
                }
            );
            console.log(`✅ Bulk cleanup complete. Cleared links for ${result.modifiedCount} subscriptions.`);
        } else {
            console.log("Nothing to clear.");
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("Bulk cleanup failed:", err);
        process.exit(1);
    }
}

bulkClearLinks();
