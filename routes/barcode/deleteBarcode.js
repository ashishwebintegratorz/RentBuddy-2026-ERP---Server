const express = require("express");
const router = express.Router();
const Barcode = require("../../models/barcode");
const Product = require("../../models/product");
const verifyToken = require("../../middlewares/verifyToken");

router.delete("/:barcodeId", verifyToken, async (req, res) => {
  try {
    const barcode = await Barcode.findById(req.params.barcodeId);

    if (!barcode) {
      return res.status(404).json({
        success: false,
        message: "Barcode not found",
      });
    }

    // ❌ Block rented barcode
    if (barcode.status === "rented") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete rented barcode",
      });
    }

    const productId = barcode.rentalItem.productID;

    /* ================= DELETE / RETIRE BARCODE ================= */

    if (barcode.rentalHistory.length === 0) {
      await Barcode.findByIdAndDelete(barcode._id);
    } else {
      barcode.status = "retired";
      barcode.retiredAt = new Date();
      await barcode.save();
    }

    /* ================= RECALCULATE PRODUCT ================= */

    const availableCount = await Barcode.countDocuments({
      "rentalItem.productID": productId,
      status: "available",
    });

    const activeBarcodeExists = await Barcode.exists({
      "rentalItem.productID": productId,
      status: { $in: ["available", "damaged"] },
    });

    await Product.findByIdAndUpdate(productId, {
      stocks: availableCount,
      availability: availableCount > 0 ? "available" : "unavailable",
      isDeleted: !activeBarcodeExists,
      ...(activeBarcodeExists ? {} : { deletedAt: new Date() }),
    });

    res.json({
      success: true,
      message: "Barcode deleted and product stock synced",
    });
  } catch (err) {
    console.error("Barcode delete error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
