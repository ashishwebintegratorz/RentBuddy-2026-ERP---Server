const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/verifyToken');
const Rental = require('../../models/rentalProducts');
const Order = require('../../models/orders')

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const rentals = await Rental.find({ userId })
      .populate('userId', 'username customerId')
      .populate('productId', 'productName productId rentalPrice') // Adjust the second parameter with the fields you want to populate from the product schema
      .populate('orderId', 'paymentType cashfreeAuthLink paymentStatus totalAmount documents documentStatus');

    const rentalsWithPaymentInfo = await Promise.all(rentals.map(async (rental) => {
      let authLink = null;
      let orderPaymentStatus = null;
      let totalOrderAmount = null;
      let orderPaymentType = null;
      let documents = null;
      let documentStatus = null;

      if (rental.orderId) {
        orderPaymentType = rental.orderId.paymentType;
        documents = rental.orderId.documents;
        documentStatus = rental.orderId.documentStatus;
        if (orderPaymentType === 'Recurring Payment') {
          authLink = rental.orderId.cashfreeAuthLink;
          orderPaymentStatus = rental.orderId.paymentStatus;
          totalOrderAmount = rental.orderId.totalAmount;
        }
      }

      return {
        ...rental.toObject(),
        authLink,
        orderPaymentStatus,
        totalOrderAmount,
        orderPaymentType,
        documents,
        documentStatus
      };
    }))
    console.log(rentalsWithPaymentInfo)
    res.status(200).json({ success: true, data: rentalsWithPaymentInfo });
  } catch (error) {
    console.error('Error retrieving rentals:', error);
    res.status(500).json({ message: 'Error retrieving rentals', error: error.message });
  }
});

module.exports = router;
