const express = require("express");
const router = express.Router();
const Product = require("../../models/product");
const Barcode = require("../../models/barcode");
const { generateBarcodeBase64 } = require("../../utils/barcodeGenerator");

/* ================= HELPERS ================= */

function generateBrID(index = 0) {
  return `BR-${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`;
}

/* =====================================================
   ➕ ADD STOCK
===================================================== */

router.put("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { addStock } = req.body;

    if (!addStock || addStock <= 0) {
      return res.status(400).json({ success: false, message: "Invalid stock value" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const existingCount = await Barcode.countDocuments({
      "rentalItem.productID": product._id,
    });

    const cityPrefix =
      (product.city && product.city.slice(0, 3).toUpperCase()) || "GEN";

    const barcodes = [];

    for (let i = 0; i < addStock; i++) {
      const serialNumber = existingCount + i + 1;

      const brID = generateBrID(i);
      const productSerialID = `${cityPrefix}-${String(serialNumber).padStart(4, "0")}`;
      const barcodeImg = await generateBarcodeBase64(brID);

      barcodes.push({
        brID,
        barcodeImg,
        rentalItem: {
          productID: product._id,
          productSerialID,
          rentalDuration: "12 Months",
          productName: product.productName,
          rentalPrice: product.rentalPrice,
        },
        status: "available",
        rentalHistory: [],
      });
    }

    await Barcode.insertMany(barcodes);

    product.stocks += addStock;

    // Update availability if it was out of stock
    if (product.stocks > 0) {
      product.availability = 'available';
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Stock added successfully",
      totalStock: product.stocks,
    });
  } catch (err) {
    console.error("Add stock error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
