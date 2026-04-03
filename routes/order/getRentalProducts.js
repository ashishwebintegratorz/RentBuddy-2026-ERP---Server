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
      .populate('orderId', 'paymentType cashfreeAuthLink paymentStatus totalAmount');

    console.log(rentals)
    const rentalsWithPaymentInfo = await Promise.all(rentals.map(async (rental) => {
      let authLink = null;
      let orderPaymentStatus = null; // To get the overall order payment status
      let totalOrderAmount = null; // To get the total amount of the associated order
      let orderPaymentType = null; // Explicitly capture paymentType

      // If the rental is part of a recurring payment, find the associated order
      // and fetch its Cashfree authorization link and payment status.
      // We assume rental.orderId is populated here or added in the previous step.
      if (rental.orderId) { // Check if orderId is populated
        orderPaymentType = rental.orderId.paymentType;
        if (orderPaymentType === 'Recurring Payment') {
          authLink = rental.orderId.cashfreeAuthLink;
          orderPaymentStatus = rental.orderId.paymentStatus;
          totalOrderAmount = rental.orderId.totalAmount;
        }
      }


      return {
        ...rental.toObject(), // Convert Mongoose document to a plain JavaScript object
        authLink: authLink,
        orderPaymentStatus: orderPaymentStatus,
        totalOrderAmount: totalOrderAmount,
        // to explicitly pass the order's paymentType here as well
        orderPaymentType: orderPaymentType
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
