const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Barcode = require("../../models/barcode");
const Product = require("../../models/product");
const verifyToken = require("../../middlewares/verifyToken");

router.post("/:barcodeId/return", verifyToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const barcode = await Barcode.findById(req.params.barcodeId).session(session);

    if (!barcode) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Barcode not found" });
    }

    // 🚫 Only rented items can be returned
    if (barcode.status !== "rented") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Only rented barcodes can be returned",
      });
    }

    // 1️⃣ Update barcode
    barcode.status = "available";
    barcode.damagedAt = null;
    barcode.damageNotes = "";
    barcode.currentRental = null;

    await barcode.save({ session });

    // 2️⃣ Sync product stock
    const availableCount = await Barcode.countDocuments({
      "rentalItem.productID": barcode.rentalItem.productID,
      status: "available",
    }).session(session);

    await Product.findByIdAndUpdate(
      barcode.rentalItem.productID,
      {
        stocks: availableCount,
        availability: availableCount > 0 ? "available" : "out-of-stock",
      },
      { session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Item returned & stock updated",
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
});

module.exports = router;
