const express = require("express");
const verifyToken = require("../../middlewares/verifyToken");
const Barcode = require("../../models/barcode");

const router = express.Router();

/**
 * GET /barcodes/product/:productId
 * Optional query params:
 *  - page
 *  - limit
 *  - status (available | rented | maintenance | retired)
 */
router.get("/:productID", verifyToken, async (req, res) => {
  try {
    const { productID } = req.params;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const status = req.query.status;

    // 🔹 Build filter
    const filter = {
      "rentalItem.productID": productID,
    };

    if (status) {
      filter.status = status;
    }

    const total = await Barcode.countDocuments(filter);

    const barcodes = await Barcode.find(filter)
      .populate("currentRental.customerID", "username email phone")
      .populate("rentalHistory.customerID", "username email phone")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: "Product barcodes fetched successfully",
      productID, // ✅ FIXED
      total,
      count: barcodes.length,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: barcodes,
    });
  } catch (error) {
    console.error("Error fetching product barcodes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product barcodes",
    });
  }
});

module.exports = router;


