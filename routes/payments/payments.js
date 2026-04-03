const express = require('express');
const router = express.Router();
const addPayments = require('./addPayments')
const getPayments = require('./getPayments')
const recurringPayments = require('./recurringPayments')
const cashFreeRecurringPayments = require('./cashfreeRecurring');
const manualPayment = require('./manualPayment')
const razorpay = require('./razorpay');
const razorpayWebhook = require('./razorpayWebhook');
const analyticsRoute = require('./billingAnalytics');
const strictReminderRoute = require('./sendStrictReminder');
const subscriptionSkipMonthRoute = require('./subscriptionSkipMonth');
const { cancelSubscription } = require('./subscriptionController');
const verifyToken = require('../../middlewares/verifyToken');



router.use('/analytics', analyticsRoute);
router.use('/addPayments', addPayments)
router.use('/manual-payment', manualPayment)
router.use('/getPayments', getPayments)
router.use('/recurringPayments', recurringPayments);
router.use('/cashfreeRecurring', cashFreeRecurringPayments);
router.use('/razorpay', razorpay);
router.use('/razorpay/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);

// Special Routes 
// These routes handle specific subscription-related actions
router.use('/skip-month', subscriptionSkipMonthRoute);
router.use('/strict-reminder', strictReminderRoute);

router.post("/cancel", verifyToken, cancelSubscription);

module.exports = router;