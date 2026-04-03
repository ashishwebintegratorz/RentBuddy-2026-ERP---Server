const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: true,
    default: () => `ORD-${Date.now()}`
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  billingInfo: {
    firstName: String,
    lastName: String,
    phone: String,
    email: String,
    address: String,
    landmark: String,
    town: String,
    state: String,
    postcode: String,
    emiDate: String,
  },

  package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },

  items: [
    {
      itemType: {
        type: String,
        enum: ['product', 'package'],
        default: 'product',
        required: true
      },
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: function () { return this.itemType === 'product'; }
      },
      packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        required: function () { return this.itemType === 'package'; }
      },
      productName: { type: String, required: true },
      productSerialId: { type: String },
      quantity: { type: Number, default: 1 },
      rentalDuration: { type: String },
      price: { type: Number, required: true },
      rent: { type: Number, required: true },
    },
  ],

  totalAmount: { type: Number, required: true },
  paymentType: {
    type: String,
    enum: ['Cumulative Payment', 'Recurring Payment'],
    required: true,
  },
  paymentMethod: { type: String, required: true },

  razorpayOrderId: { type: String },
  cashfreeOrderId: { type: String },

  invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }],
  paymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],

  subscriptionId: { type: String },
  subscriptionShortUrl: { type: String },
  cashfreeAuthLink: { type: String },
  oneTimePaymentLink: { type: String },

  paymentStatus: { type: String, default: 'Pending' },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Completed'],
    default: 'Pending',
  },

  refundableDeposit: { type: Number },
  orderNotes: { type: String },
  cgst: { type: Number, required: true },
  igst: { type: Number, required: true },
  productRent: { type: Number, required: true },
  couponCode: { type: String },
  depositAmount: { type: Number },

  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Package",
    default: null,
  },

  isPackageOrder: {
    type: Boolean,
    default: false,
  },


  // ✅ this is exactly what we need
  barcodeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Barcode' }],

  // mark if all stock/rental/barcode/invoice work has been done
  fulfilled: { type: Boolean, default: false },
}, {
  timestamps: true,
});

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;
