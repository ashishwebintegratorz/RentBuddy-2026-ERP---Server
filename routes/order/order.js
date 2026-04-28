// orderRoutes.js
const express = require('express');
const router = express.Router();
const createOrderRoute = require('./addOrder');
const getOrderRoute = require('./getOrders');
const getRentalProducts = require('./getRentalProducts');
const addInvoice = require('./addInvoice');
const getInvoice = require('./getInvoice');
const returnProduct = require('./returnProduct');
const getReturnProducts = require('./getReturnedProducts');
const documentsVerification = require('./documentsVerification');
const getDocuments = require('./getDocuments');
const updateDocStatus = require('./updateDocStatus');
const updateOrderDocStatus = require('./updateOrderDocStatus');
const mostRented = require('./most-rented');
const {deleteOrder} = require('./deleteOrder');
const checkSubscriptionStatus = require('./checkSubscriptionStatus');
const statsController = require('./statsController');
const verifyToken = require('../../middlewares/verifyToken');
const getOrderAnalytics = require('./orderAnalytics').getOrderAnalytics;

          
router.get('/analytics', verifyToken, getOrderAnalytics);
router

router.delete('/:orderId',verifyToken, deleteOrder);
router.get('/status/:orderId', verifyToken, async (req, res) => {
    try {
        const Order = require('../../models/orders');
        const Subscription = require('../../models/subscription');
        
        const order = await Order.findById(req.params.orderId).select('paymentStatus status orderId subscriptionId');
        if (!order) return res.status(404).json({ message: "Order not found" });

        let effectivePaymentStatus = order.paymentStatus;

        // If it's a recurring order, check the subscription status as well
        if (order.subscriptionId) {
            const sub = await Subscription.findOne({ 
                $or: [
                    { subscriptionId: order.subscriptionId },
                    { orderInternalId: order._id }
                ]
            });

            if (sub) {
                // If mandate is authorized or sub is active, treat as 'Paid' for the UI
                if (sub.isMandateAuthorized || sub.status === 'active' || sub.status === 'authenticated') {
                    effectivePaymentStatus = "Paid";
                }
            }
        }

        res.json({ 
            paymentStatus: effectivePaymentStatus, 
            status: order.status,
            orderId: order.orderId
        });
    } catch (err) {
        console.error("[order.status] err", err);
        res.status(500).json({ message: err.message });
    }
});
router.use('/createOrder', createOrderRoute);
router.use('/check-subscription-status', checkSubscriptionStatus);
router.use('/getOrders', getOrderRoute);
router.get('/orders-by-state', verifyToken ,statsController.getOrdersStats);
router.use('/getRentalProducts', getRentalProducts)      
router.use('/mostRented', mostRented)
router.use('/addInvoice', addInvoice)
router.use('/getInvoice', getInvoice)
router.use('/returnProduct', returnProduct);
router.use('/documentsVerification', documentsVerification);
router.use('/getReturnProducts', getReturnProducts);
router.use('/getDocument', getDocuments);
router.use('/updateDocStatus', updateDocStatus);
router.use('/updateOrderDocStatus', updateOrderDocStatus);
router.use('/updateOrderDocuments', require('./updateOrderDocuments'));

module.exports = router;