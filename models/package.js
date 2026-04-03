const mongoose = require("mongoose");

const packageItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const packageSchema = new mongoose.Schema(
  {
    packageName: {
      type: String,
      required: true,
      unique: true,
    },

    description: {
      type: String,
    },

    // 🔹 Products included in the package
    items: {
      type: [packageItemSchema],
      required: true,
    },

    // 🔹 Allowed rental durations (customer chooses ONE)
    allowedDurations: {
      type: [Number], // [3, 6, 12]
      default: [3, 6, 12],
      validate: {
        validator: (arr) => arr.every((d) => [3, 6, 12].includes(d)),
        message: "Allowed durations can only be 3, 6, or 12 months",
      },
    },

    // 🔹 Monthly price for entire package
    monthlyPrice: {
      type: Number,
      required: true,
    },

    // 🔹 Refundable deposit
    depositAmount: {
      type: Number,
      default: 0,
    },

    city: {
      type: String,
    },

    image: {
      type: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package", packageSchema);
