// models/subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  subscriptionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderId: { type: String },
  orderInternalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  planId: { type: String },
  planAmount: { type: Number },
  currency: { type: String, default: 'INR' },

  startAt: { type: Date },
  nextChargeAt: { type: Date },
  mandateId: { type: String },
  shortUrl: { type: String },

  // App-level status
  status: { type: String, enum: ['created', 'active', 'past_due', 'expired', 'cancelled', 'halted'], default: 'created' },

  // Missed payment tracking
  missedPayments: { type: Number, default: 0 },
  lastPaymentAt: { type: Date },
  graceUntil: { type: Date },

  // Notification flags so we don't spam multiple times
  notifiedOnFailure: { type: Boolean, default: false }, // immediate failure notice sent
  notifiedTwoDaysBefore: { type: Boolean, default: false }, // 2-day reminder
  notifiedOnExpiry: { type: Boolean, default: false }, // final notice sent on expire

  // High-priority flags for cron monitoring
  notifiedDue: { type: Boolean, default: false },
  notifiedGrace: { type: Boolean, default: false },
  notifiedGraceFinal: { type: Boolean, default: false },
  notifiedStrict: { type: Boolean, default: false },
  lastNotifiedCycle: { type: Date }, // Stores the due date (nextChargeAt) of the last notified cycle

  raw: { type: Object },// store provider payload for debugging
  autoMandateCancelled: { type: Boolean, default: false },
  mandateStatus: { type: String, default: "active" }, // active | cancelled | inactive | unknown

  // Fallback payment link for when mandate fails
  oneTimePaymentLink: { type: String },
  oneTimePaymentLinkId: { type: String }

}, { timestamps: true });


module.exports = mongoose.model('Subscription', subscriptionSchema);
