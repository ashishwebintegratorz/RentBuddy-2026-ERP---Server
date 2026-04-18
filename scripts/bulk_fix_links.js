const mongoose = require('mongoose');
const Subscription = require('../models/subscription');
require('dotenv').config();

async function bulkFixLinks() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Connected to DB");

        // Targeted update for subscriptions still using initial links
        const result = await Subscription.updateMany(
            {
                oneTimePaymentLink: { $exists: true, $ne: null },
                lastNotifiedCycle: { $exists: false }
            },
            {
                $set: { 
                    oneTimePaymentLink: null, 
                    oneTimePaymentLinkId: null 
                }
            }
        );

        console.log(`\n--- Bulk Fix Result ---`);
        console.log(`Matched: ${result.matchedCount}`);
        console.log(`Modified: ${result.modifiedCount}`);
        
        console.log("\nSuccessfully cleared outdated links. The cron job will regenerate correct links for these users on their next reminder.");

        process.exit(0);
    } catch (err) {
        console.error("Bulk fix failed:", err);
        process.exit(1);
    }
}

bulkFixLinks();
