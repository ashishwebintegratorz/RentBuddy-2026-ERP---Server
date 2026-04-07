const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Rental = require('../models/rentalProducts');
const Order = require('../models/orders');

async function debugData(id) {
  try {
    const url = process.env.MONGODB_URL || process.env.MONGO_URI;
    await mongoose.connect(url);
    console.log('--- Connected to DB ---');

    console.log(`Searching for ID: ${id}`);
    
    // 1. Try finding Order first
    let order = await Order.findOne({ orderId: id });
    if (!order && mongoose.Types.ObjectId.isValid(id)) {
       order = await Order.findById(id);
    }

    if (order) {
      console.log('\n--- ORDER RECORD ---');
      console.log({
        _id: order._id,
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        productRent: order.productRent,
        rentalDuration: order.rentalDuration,
        paymentType: order.paymentType,
        depositAmount: order.depositAmount,
        cgst: order.cgst,
        igst: order.igst
      });

      // Find rental by order _id
      const rental = await Rental.findOne({ orderId: order._id });
      if (rental) {
        console.log('\n--- RENTAL RECORD ---');
        console.log({
          rentalId: rental.rentalId,
          rentedTill: rental.rentedTill,
          rentalDuration: rental.rentalDuration,
          subscriptionId: rental.subscriptionId
        });
      } else {
        console.log('Rental linked to this order NOT FOUND');
      }
    } else {
       console.log('Order NOT FOUND');
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

const targetId = process.argv[2]; 
debugData(targetId);
