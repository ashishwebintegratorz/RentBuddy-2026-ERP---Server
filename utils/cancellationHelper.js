const razorpay = require('../services/razorpayClient');
const Subscription = require('../models/subscription');
const Rental = require('../models/rentalProducts');

/**
 * Unified helper to cancel a subscription across Razorpay and local DB.
 * 
 * @param {string} subscriptionId - The Razorpay Subscription ID (e.g., 'sub_xxx')
 * @param {string} reason - Optional reason for cancellation
 * @param {boolean} cancelImmediately - If true, cancels immediately. If false, cancels at the end of the current cycle.
 * @returns {Promise<object>} - Result of the cancellation process
 */
async function cancelSubscription(subscriptionId, reason = 'Admin Action', cancelImmediately = true) {
    console.log(`[CANCELLATION HELPER] Initiating cancellation for ${subscriptionId}. Reason: ${reason}`);
    
    let razorpayResult = null;
    let dbResult = { subscriptionUpdated: false, rentalsUpdatedCount: 0 };

    try {
        // 1. Cancel on Razorpay
        // Razorpay API: POST /subscriptions/:id/cancel
        try {
            razorpayResult = await razorpay.subscriptions.cancel(subscriptionId, cancelImmediately);
            console.log(`[CANCELLATION HELPER] Razorpay cancellation successful for ${subscriptionId}`);
        } catch (rzpErr) {
            // If subscription is already cancelled or not found on Razorpay, we still want to sync our DB
            console.warn(`[CANCELLATION HELPER] Razorpay API warning for ${subscriptionId}:`, rzpErr.description || rzpErr.message);
            razorpayResult = { error: rzpErr.message, status: 'failed_on_rzp' };
        }

        // 2. Update local Subscription model
        const sub = await Subscription.findOneAndUpdate(
            { subscriptionId: subscriptionId },
            { 
                $set: { 
                    status: 'cancelled',
                    notifiedDue: false,
                    notifiedGrace: false,
                    notifiedStrict: false,
                    notifiedOnFailure: false,
                    notifiedTwoDaysBefore: false,
                    graceUntil: null
                } 
            },
            { new: true }
        );

        if (sub) {
            dbResult.subscriptionUpdated = true;
            
            // 3. Update all associated Rental records
            const rentalUpdate = await Rental.updateMany(
                { subscriptionId: subscriptionId },
                { 
                    $set: { 
                        subscriptionStatus: 'cancelled',
                        // Note: We don't necessarily mark rentalStatus as 'completed' here 
                        // unless it's a full return/refund, which is handled at the route level.
                    } 
                }
            );
            dbResult.rentalsUpdatedCount = rentalUpdate.modifiedCount;
            console.log(`[CANCELLATION HELPER] DB sync complete for ${subscriptionId}. Updated ${rentalUpdate.modifiedCount} rentals.`);
        } else {
            console.warn(`[CANCELLATION HELPER] No local Subscription record found for ${subscriptionId}`);
        }

        return {
            success: true,
            razorpayStatus: razorpayResult ? (razorpayResult.status || 'success') : 'skipped',
            dbStatus: dbResult
        };

    } catch (error) {
        console.error(`[CANCELLATION HELPER] Fatal error during cancellation of ${subscriptionId}:`, error);
        throw error;
    }
}

module.exports = { cancelSubscription };
