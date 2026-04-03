const express = require("express");
const router = express.Router();
const Barcode = require("../../models/barcode");
const Product = require("../../models/product");
const verifyToken = require("../../middlewares/verifyToken");

router.post("/:barcodeId/damage", verifyToken, async (req, res) => {
  const { note } = req.body;

  const barcode = await Barcode.findById(req.params.barcodeId);

  if (!barcode) {
    return res.status(404).json({ success: false });
  }

  if (barcode.status === "rented") {
    return res.status(400).json({
      success: false,
      message: "Cannot mark rented barcode as damaged",
    });
  }

  barcode.status = "damaged";
  barcode.damageNotes = note || "";
  barcode.damagedAt = new Date();

  await barcode.save();

  // Sync product stock
  if (barcode.rentalItem && barcode.rentalItem.productID) {
    const availableCount = await Barcode.countDocuments({
      "rentalItem.productID": barcode.rentalItem.productID,
      status: "available",
    });

    await Product.findByIdAndUpdate(barcode.rentalItem.productID, {
      stocks: availableCount,
      availability: availableCount > 0 ? "available" : "out-of-stock",
    });
  }

  res.json({ success: true, message: "Barcode marked as damaged and stock updated" });
});

module.exports = router;
