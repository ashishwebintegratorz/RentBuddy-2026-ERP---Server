const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/auth')
const {
  Cashfree
} = require('cashfree-pg');
const verifyToken = require('../middlewares/verifyToken');



Cashfree.XClientId = process.env.CASHFREE_APP_XCLIENT_ID;

Cashfree.XClientSecret = process.env.CASHFREE_APP_XClientSecret;

Cashfree.XEnvironment = Cashfree.Environment.SANDBOX;


function generateOrderId() {
  const uniqueId = crypto.randomBytes(16).toString('hex');

  const hash = crypto.createHash('sha256');
  hash.update(uniqueId);

  const orderId = hash.digest('hex');

  return orderId.substr(0, 12);
}

router.post('/sessionId', verifyToken, async (req, res) => {
  try {
    const { totalAmount } = req.body;

    if (!totalAmount) {
      return res.status(400).json({ message: "Total amount is required" });
    }

    // Fetch user from DB
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const request = {
      order_amount: totalAmount,
      order_currency: "INR",
      order_id: generateOrderId(),
      customer_details: {
        customer_id: user.customerId || user._id.toString(),
        customer_name: req.user.username,
        customer_email: req.user.email,
        customer_phone: user.phone || "9999999999" // fallback if phone missing
      },
    };
    console.log("Request Amount:", request);    

    try {
      const response = await Cashfree.PGCreateOrder("2023-08-01", request);
      console.log("Response:", response);      
      res.json(response.data);
    } catch (error) {
      console.error("Cashfree error:", error.response?.data || error.message);
      res.status(500).json({
        message: error.response?.data?.message || "Cashfree order creation failed",
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



router.post('/verifyPayment', async (req, res) => {
  try {
    let { orderId } = req.body;
    const response = Cashfree.PGOrderFetchPayments("2023-08-01", orderId)

    if (response?.data?.length > 0) {
      const paymentInfo = response.data[0];

      if (paymentInfo.payment_status === "SUCCESS" && paymentInfo.is_captured) {
        // Save this to DB (optional)
        // Update related order status in DB

        return res.json({
          message: "Payment verified successfully",
          success: true,
          data: paymentInfo
        });
      } else {
        return res.status(400).json({
          message: "Payment not successful",
          success: false,
          data: paymentInfo
        });
      }
    } else {
      return res.status(404).json({ message: "No payment data found" });
    }
  } catch (error) {
    console.log(error);
  }
})

module.exports = router;