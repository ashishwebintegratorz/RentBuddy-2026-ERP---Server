const mongoose = require('mongoose');
const Subscription = require('../models/subscription');
const User = require('../models/auth');
const Order = require('../models/orders');
const razorpay = require('../services/razorpayClient');
require('dotenv').config();

async function auditLinks() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Connected to DB");

        // Find all active/past_due subscriptions that have a payment link
        const subs = await Subscription.find({ 
            oneTimePaymentLink: { $exists: true, $ne: null },
            status: { $in: ['active', 'past_due'] }
        }).populate('userId').populate('orderInternalId');

        console.log(`Found ${subs.length} active/past_due subscriptions with payment links.`);

        const reports = [];

        for (const sub of subs) {
            const order = sub.orderInternalId;
            if (!order) continue;

            // If the subscription's payment link is the SAME as the order's payment link,
            // then it DEFINITELY includes the deposit/initial charge.
            const isInitialLink = sub.oneTimePaymentLink === order.oneTimePaymentLink;
            
            // Or if they were created at the same time (approx)
            // But checking the link string is more definitive.

            if (isInitialLink) {
                // Now check if the amount matches.
                // Initial links usually match order.totalAmount (e.g. 6112.14)
                // Monthly links should match sub.planAmount / 100 (e.g. 2741.14)
                
                const planAmountRupees = sub.planAmount / 100;
                const orderTotalAmount = order.totalAmount;

                if (Math.abs(planAmountRupees - orderTotalAmount) > 1) {
                    reports.push({
                        email: sub.userId?.email,
                        subscriptionId: sub.subscriptionId,
                        orderId: order.orderId,
                        planAmount: planAmountRupees,
                        linkAmount: orderTotalAmount, // Since it's the same link
                        discrepancy: orderTotalAmount - planAmountRupees,
                        linkUrl: sub.oneTimePaymentLink
                    });
                    console.log(`[DISCREPANCY FOUND] User: ${sub.userId?.email}`);
                    console.log(`  - Sub Plan Amount: ${planAmountRupees}`);
                    console.log(`  - Link Amount (Order Total): ${orderTotalAmount}`);
                }
            }
        }

        console.log("\n--- Full Discrepancy Report ---");
        console.log(JSON.stringify(reports, null, 2));
        console.log(`Total discrepancies found: ${reports.length}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

auditLinks();
