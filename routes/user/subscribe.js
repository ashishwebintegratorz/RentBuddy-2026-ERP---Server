const express = require('express');
const router = express.Router();
const Subscribe = require('../../models/subscription');
const User = require('../../models/auth');
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const username = req.user.username;
        const { email, duration, amount, paymentType } = req.body;

        let subscriptionTotalAmount = 0;
        switch (duration) {
            case '3 months':
                subscriptionTotalAmount = 500 + (500 * 0.18);
                break;
            case '6 months':
                subscriptionTotalAmount = 990 + (990 * 0.18);
                break;
            case '12 months':
                subscriptionTotalAmount = 1480 + (1480 * 0.18);
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid duration format' });
        }

        const subscriptionDate = new Date();
        const subscriptionEndDate = new Date(subscriptionDate);
        
        const durationParts = duration.split(' ');
        const months = parseInt(durationParts[0]);
        
        if (isNaN(months)) {
            return res.status(400).json({ success: false, message: 'Invalid duration format' });
        }

        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);

        let lastPayment = amount;
        let paidAmount = lastPayment;
        let remainingAmount = subscriptionTotalAmount - paidAmount; 
        const existingSubscription = await Subscribe.findOne({ userId });

        if (existingSubscription) {
            paidAmount += existingSubscription.paidAmount;
            remainingAmount = subscriptionTotalAmount - paidAmount;
        }

        // Extract the day of the month from the subscriptionDate
        const dayOfMonth = subscriptionDate.getDate();
        const billingCycle = `${dayOfMonth}th of every month`;

        const newSubscription = await Subscribe.create({
            userId,
            username,
            email,
            duration,
            lastPayment,
            paidAmount,
            remainingAmount,
            subscriptionTotalAmount,
            paymentType,
            subscriptionDate,
            subscriptionEndDate,
            billingCycle, // Add billingCycle here
        });

        await User.findByIdAndUpdate(userId, {
            subcriptionId: newSubscription._id,
            isSubscribed: true
        });

        res.status(200).json({ success: true, message: 'Subscription created and user updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
