const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  documents: {
    aadhar: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },
    pan: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },
    rentAgreement: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },
    idProof: {
      url: String,
      publicId: String,
      uploadedAt: Date
    }
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;