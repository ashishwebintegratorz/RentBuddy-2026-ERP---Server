const mongoose = require("mongoose");
const User = require("../models/auth");
const Subscription = require("../models/subscription");
const Payment = require("../models/payment");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  const subs = await Subscription.find({ nextChargeAt: null }).populate('userId').lean();
  const results = [];
  
  for (const s of subs) {
    const paymentCount = await Payment.countDocuments({
      $or: [
        { userId: s.userId?._id },
        { razorpaySubscriptionId: s.subscriptionId },
        { orderId: s.orderId },
        { orderId: s.orderInternalId?.toString() },
        { razorpayOrderId: s.raw?.notes?.razorpay_order_id }
      ].filter(q => Object.values(q)[0]),
      paymentStatus: 'Success'
    });
    
    if (paymentCount > 0) {
      results.push({
        email: s.userId?.email || 'Unknown',
        name: s.userId?.name || 'Unknown',
        subId: s.subscriptionId,
        totalPayments: paymentCount
      });
    }
  }
  
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

run();
