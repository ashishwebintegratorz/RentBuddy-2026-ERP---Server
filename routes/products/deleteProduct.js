const express = require("express");
const router = express.Router();
const Product = require("../../models/product");
const Barcode = require("../../models/barcode");
const verifyToken = require("../../middlewares/verifyToken");
const mongoose = require("mongoose");

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const productId = new mongoose.Types.ObjectId(req.params.id);

    // 1️⃣ Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // 2️⃣ OPTIONAL SAFETY: check if any barcode is rented
    const rentedBarcode = await Barcode.findOne({
      "rentalItem.productID": productId,
      status: "rented",
    });

    if (rentedBarcode) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete product. Some items are currently rented.",
      });
    }

    // 3️⃣ Delete all barcodes related to this product
    await Barcode.deleteMany({
      "rentalItem.productID": productId,
    });

    // 4️⃣ Delete the product
    await Product.findByIdAndDelete(productId);

    return res.status(200).json({
      success: true,
      message: "Product and related barcodes deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;


router.delete("/:id/soft", verifyToken, async (req, res) => {
  try {
    const productId = new mongoose.Types.ObjectId(req.params.id);

    // 1️⃣ Check product
    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // 2️⃣ Block if rented
    const rented = await Barcode.findOne({
      "rentalItem.productID": productId,
      status: "rented",
    });

    if (rented) {
      return res.status(400).json({
        success: false,
        message: "Active rentals exist. Cannot delete product.",
      });
    }

    // 3️⃣ Soft delete product
    product.isDeleted = true;
    await product.save();

    // 4️⃣ Handle barcodes
    const barcodes = await Barcode.find({
      "rentalItem.productID": productId,
    });

    for (const bc of barcodes) {
      if (bc.rentalHistory.length === 0) {
        await Barcode.findByIdAndDelete(bc._id);
      } else {
        bc.status = "retired";
        await bc.save();
      }
    }

    res.json({
      success: true,
      mode: "soft-delete",
      message: "Product soft deleted safely",
    });
  } catch (err) {
    console.error("Soft delete error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
