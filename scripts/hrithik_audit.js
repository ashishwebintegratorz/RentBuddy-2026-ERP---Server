const mongoose = require("mongoose");
const User = require("../models/auth");
const Payment = require("../models/payment");
const Subscription = require("../models/subscription");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  const user = await User.findOne({ email: "brise.management@gmail.com" });
  if (!user) {
    console.log("User not found");
    process.exit(0);
  }

  const payments = await Payment.find({
    $or: [
      { userId: user._id },
      { customerName: /Hrithik/i },
      { orderId: /1771969287421/ }
    ]
  }).sort({ paymentDate: -1 }).lean();

  console.log("Payments for Hrithik (" + user.email + "):");
  payments.forEach((p, i) => {
    console.log((i+1) + ". ID: " + p.paymentId + " | Status: " + p.paymentStatus + " | Amount: " + p.amount + " | Date: " + p.paymentDate + " | OrderId: " + p.orderId);
  });

  const subs = await Subscription.find({ userId: user._id }).lean();
  console.log("\nSubscriptions for Hrithik:");
  subs.forEach((s, i) => {
    console.log((i+1) + ". ID: " + s.subscriptionId + " | Status: " + s.status + " | NextCharge: " + s.nextChargeAt + " | Link: " + s.oneTimePaymentLink);
  });

  process.exit(0);
}

run();
