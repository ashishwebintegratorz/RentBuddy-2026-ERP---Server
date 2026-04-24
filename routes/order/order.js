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