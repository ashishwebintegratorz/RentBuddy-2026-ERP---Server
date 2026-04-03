const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Barcode = require("../../models/barcode");
const Product = require("../../models/product");
const verifyToken = require("../../middlewares/verifyToken");

router.post("/:barcodeId/available", verifyToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const barcode = await Barcode.findById(req.params.barcodeId).session(session);

    if (!barcode) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Barcode not found" });
    }

    // 🚫 Prevent double stock increment
    if (barcode.status === "available") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Barcode is already available",
      });
    }

    // 1️⃣ Update barcode status
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
      message: "Barcode marked available & stock updated",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
});

module.exports = router;
