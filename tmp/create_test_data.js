const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('../models/orders');
const Subscription = require('../models/subscription');
const Rental = require('../models/rentalProducts');

const userId = '69550ee9b5006c561ded7df9';
const productId = '69aabde6c02b7e69df0258e9';

async function setupTestData() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('DB Connected');

  try {
    const testSubId = 'sub_test_' + Date.now();
    const testRentalId = 'RENT' + Math.floor(Math.random() * 100000);

    const order = await Order.create({
      userId,
      totalAmount: 1000,
      paymentType: 'Recurring Payment',
      paymentMethod: 'razorpay',
      cgst: 0,
      igst: 0,
      productRent: 1000,
      items: [{
         itemType: 'product',
         productId,
         productName: 'Test Product',
         price: 1000,
         rent: 1000
      }]
    });

    const sub = await Subscription.create({
      subscriptionId: testSubId,
      userId,
      orderInternalId: order._id,
      orderId: order.orderId,
      planAmount: 50000,
      status: 'active',
      nextChargeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const rental = await Rental.create({
      rentalId: testRentalId,
      userId,
      productId,
      orderId: order._id,
      rentedDate: new Date(),
      rentedTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      rentalDuration: '6 Months',
      paymentStatus: 'Paid',
      subscriptionId: testSubId,
      totalPaymentsRequired: 6,
      paymentsMade: 1,
      paymentMode: 'Recurring Payment' // Fixed: Use enum value
    });

    console.log('--- SUCCESS ---');
    console.log('Rental ID:', testRentalId);
    console.log('Subscription ID:', testSubId);

  } catch (err) {
    console.log('Error:', err.message || err);
  }
  process.exit(0);
}

setupTestData();
