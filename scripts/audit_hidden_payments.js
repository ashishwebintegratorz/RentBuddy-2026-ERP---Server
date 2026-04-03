const mongoose = require("mongoose");
const fs = require("fs");
const Payment = require("../models/payment");
const Order = require("../models/orders");
const User = require("../models/auth");
require("dotenv").config();

async function audit() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected.");

    const payments = await Payment.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    }).lean();

    console.log(`Found ${payments.length} payments with missing User linkage.`);
    console.log("--------------------------------------------------");

    const results = [];

    for (const payment of payments) {
      const order = await Order.findOne({
        $or: [
          { orderId: payment.orderId },
          { razorpayOrderId: payment.razorpayOrderId },
          { razorpayOrderId: payment.orderId }
        ]
      }).populate('userId').lean();

      if (order) {
        results.push({
          paymentId: payment.paymentId,
          amount: payment.amount,
          date: payment.paymentDate,
          orderId: order.orderId,
          userName: order.userId?.name || order.billingInfo?.firstName + " " + (order.billingInfo?.lastName || ""),
          userEmail: order.userId?.email || order.billingInfo?.email,
          status: payment.paymentStatus
        });
      } else {
        results.push({
          paymentId: payment.paymentId,
          amount: payment.amount,
          date: payment.paymentDate,
          orderId: payment.orderId,
          userName: "UNKNOWN (ORDER NOT FOUND)",
          userEmail: "UNKNOWN",
          status: payment.paymentStatus
        });
      }
    }

    if (results.length === 0) {
      console.log("No hidden payments found.");
    } else {
      const outputPath = "hidden_payments_report.json";
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`Report saved to ${outputPath}`);
      console.log(`Found ${results.length} total problematic records.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Audit failed:", err);
    process.exit(1);
  }
}

audit();
