const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const rentalHistoryItemSchema = new mongoose.Schema(
  {
    barcodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Barcode',
    },
    serial: {
      type: String, // e.g. IND-0001
    },
    rentedDate: {
      type: Date,
      required: true,
    },
    rentedTill: {
      type: Date,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    productId: { type: Number, unique: true, index: true },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    rentalPrice: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    deposit: { type: Number, required: true },
    city: { type: String },
    stocks: { type: Number },
    description: { type: String, required: true },
    image: { type: String, required: true },

    // 🔹 now supports barcode + order refs
    rentalHistory: [rentalHistoryItemSchema],

    availability: { type: String, default: 'available' },
    subscription: { type: String, default: 'None' },
    rating: { type: String },
    date: { type: Date, default: Date.now },
    rentCount: { type: Number, default: 0 },
    offer: {
      offerCode: { type: String },
      discount: { type: String },
      validity: { type: String },
      minimumAmount: { type: String },
      date: { type: String },
    },
    durationsDiscount: {
      threeMonths: { type: String, default: '' },
      sixMonths: { type: String, default: '' },
      twelveMonths: { type: String, default: '' },
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

  },
  {
    timestamps: true,
  }
);

productSchema.plugin(AutoIncrement, { inc_field: 'productId' });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
