const mongoose = require("mongoose");
const { Schema } = mongoose;

const rentalItemSchema = new Schema(
  {
    productID: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productSerialID: { type: String, required: true },
    productName: String,
    rentalPrice: Number,
  },
  { _id: false }
);

const currentRentalSchema = new Schema(
  {
    customerID: { type: Schema.Types.ObjectId, ref: "User" },
    orderID: { type: Schema.Types.ObjectId, ref: "Order" },
    rentedDate: Date,
    rentedTill: Date,
  },
  { _id: false }
);

const rentalHistoryItemSchema = new Schema(
  {
    customerID: { type: Schema.Types.ObjectId, ref: "User" },
    orderID: { type: Schema.Types.ObjectId, ref: "Order" },
    rentedDate: Date,
    rentedTill: Date,
    rentalPrice: Number,
    conditionAtReturn: {
      type: String,
      enum: ["good", "damaged", "lost"],
      default: "good",
    },
    status: {
      type: String,
      enum: ["rented", "returned", "overdue"],
      default: "rented",
    },
  },
  { _id: false }
);

const barcodeSchema = new Schema(
  {
    brID: { type: String, required: true, unique: true, index: true },
    barcodeImg: { type: String, required: true },

    rentalItem: { type: rentalItemSchema, required: true },

    status: {
      type: String,
      enum: ["available", "rented", "damaged", "maintenance", "retired"],
      default: "available",
      index: true,
    },

    damageNotes: { type: String },
    damagedAt: { type: Date },

    currentRental: { type: currentRentalSchema, default: null },

    rentalHistory: {
      type: [rentalHistoryItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Barcode", barcodeSchema);