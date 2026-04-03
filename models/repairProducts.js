// models/Repair.js
const mongoose = require('mongoose');

// Helper function to generate a unique 3-digit returnId
function generateUniqueReturnId() {
  return Math.floor(100 + Math.random() * 900).toString();
}

const repairSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    // // required: true,
  },
  issueReported: {
    type: String,
    // // required: true,
  },
  postedBy: {
    type: String
  },
  actionTaken: {
    type: String,
    // required: true,
  },
  partsRequired: {
    type: String,
    // required: true,
  },
  estimatedCost: {
    type: Number,
    // required: true,
  },
  userId: {type: String},
  completionDate: {
    type: Date,
    // required: true,
  },
  comments: {
    type: String,
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    // required: true,
  },
  returnId: {
    type: String,
    default: generateUniqueReturnId,
    unique: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'InProgress', 'Completed', 'Cancelled'],
    default: 'Pending',
  }
}, { timestamps: true });

const Repair = mongoose.model('Repair', repairSchema);

module.exports = Repair;
