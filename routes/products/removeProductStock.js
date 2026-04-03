const Product = require("../../models/product");
const Barcode = require("../../models/barcode");
const express = require('express');
const router = express.Router()

/* =====================================================
   ➖ REMOVE STOCK (Delete barcodes safely)
===================================================== */

router.put('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { removeStock } = req.body;

    if (!removeStock || removeStock <= 0) {
      return res.status(400).json({ success: false, message: "Invalid stock value" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Fetch removable barcodes only
    const removableBarcodes = await Barcode.find({
      "rentalItem.productID": product._id,
      status: "available",
    })
      .sort({ createdAt: -1 }) // remove latest first
      .limit(removeStock);

    if (removableBarcodes.length < removeStock) {
      return res.status(400).json({
        success: false,
        message: "Not enough AVAILABLE stock to remove",
      });
    }

    const barcodeIds = removableBarcodes.map((b) => b._id);

    await Barcode.deleteMany({ _id: { $in: barcodeIds } });

    product.stocks -= removeStock;
    if (product.stocks <= 0) {
      product.stocks = 0;
      product.availability = 'out_of_stock';
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Stock removed successfully",
      data: {
        removed: removeStock,
        totalStock: product.stocks,
      },
    });
  } catch (err) {
    console.error("Remove stock error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router