const mongoose = require('mongoose');
require('dotenv').config({ path: 'd:\\New-RentBuddy-Fix-Version---Server\\.env' });
const Order = require('d:\\New-RentBuddy-Fix-Version---Server\\models\\orders');
const Payment = require('d:\\New-RentBuddy-Fix-Version---Server\\models\\payment');

async function checkRecentOrder() {
  await mongoose.connect(process.env.MONGODB_URL);
  const order = await Order.findOne().sort({ createdAt: -1 });
  console.log('Recent Order Info:');
  console.log('Order ID:', order.orderId);
  console.log('Payment Status:', order.paymentStatus);
  console.log('Status:', order.status);
  
  const payments = await Payment.find({ orderId: { $in: [order.orderId, order._id.toString()] } });
  console.log('Payments found:', payments.length);
  payments.forEach(p => {
    console.log(`- ID: ${p.paymentId}, Status: ${p.paymentStatus}, Amount: ${p.amount}`);
  });

  await mongoose.disconnect();
}

checkRecentOrder();
