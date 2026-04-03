const express = require('express');
const router = express.Router();
const authRoute = require('./auth/auth');
const userRoute = require('./user/user');
const productRoute = require('./products/products');
const reviewRoute = require('./reviews/reviews');
const cartRoute = require('./cart/cart')
const orderRoute = require('./order/order');
const cashfreeRoute = require('./payment')
const refundRoute = require('./refunds');
const paymentRoute = require('./payments/payments');
const packagesRoute = require('./packages/packages');
const barcodeRoute = require('./barcode/barcode')
const discountRoute = require('./discount/discount')
const companyStatus = require('./auth/status')


router.use('/auth', authRoute);
router.use('/user', userRoute);
router.use('/products', productRoute);
router.use('/reviews', reviewRoute);
router.use('/cart', cartRoute);
router.use('/orders', orderRoute);
router.use('/payment', cashfreeRoute);
router.use('/payments', paymentRoute);
router.use('/packages', packagesRoute);
router.use('/refunds', refundRoute);
router.use('/discount', discountRoute);
router.use('/barcode', barcodeRoute);
router.use('/company', companyStatus);

module.exports = router;