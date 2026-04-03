const mongoose = require('mongoose');

const RentalHistorySchema = new mongoose.Schema({
  brID: { type: String, required: true, index: true },
  productID: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  customerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderID: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  rentedDate: { type: Date, required: true },
  rentedTill: { type: Date, required: true },
  returnDate: { type: Date },
  rentalPrice: { type: Number, required: true },
  conditionAtReturn: { type: String, enum: ['good', 'damaged', 'lost'], default: 'good' },
  status: { type: String, enum: ['rented', 'returned'], default: 'rented' },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RentalHistory', RentalHistorySchema);
