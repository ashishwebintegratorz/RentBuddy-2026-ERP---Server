const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String }, 
  email: { type: String, required: true, unique: true },
  password: { type: String },
  phone: { type: String },
  city: { type: String },
  pincode: { type: String },
  address: { type: String },
  profilePic: { type: String },
  isSubscribed: { type: Boolean, default: false },
  subcriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'subscription',
  },
  role: { type: String, default: 'customer' },
  customerId: {
    type: String,
    unique: true,
    default: () => Math.floor(100000 + Math.random() * 900000).toString()
  },
  createdAt: { type: Date, default: Date.now },
  changed: {type: Number, default: 2},
  isPhoneVerified: { type: Boolean, default: false },
  phoneVerificationOTP: { type: String },
  phoneVerificationOTPExpires: { type: Date }
});

const User = mongoose.model('User', userSchema);

module.exports = User;