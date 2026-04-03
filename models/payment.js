// models/payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: { type: String },
  orderId: { type: String, required: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String },
  paymentDate: { type: Date, default: Date.now },
  paymentMethod: { type: String },
  cashfreeOrderId: { type: String },

  // Razorpay specific
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  razorpaySubscriptionId: { type: String },

  // store subscription short url if available (auth link)
  subscriptionShortUrl: { type: String },

  refundStatus: { type: String, default: "Pending" },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Failed', 'Completed', 'Success'],
    default: 'Pending'
  },
  transactionId: { type: String },
  paymentType: { type: String, required: true }, // 'Cumulative Payment' | 'Recurring Payment'
  emiDate: { type: String },
  amount: { type: String, required: true },
  refundAmount: { type: Number, default: 0 },
  refundDate: { type: String },
  forMonth: { type: Date }
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
