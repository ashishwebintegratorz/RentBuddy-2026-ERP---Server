const express = require("express");
const router = express.Router();
const Barcode = require("../../models/barcode");
const verifyToken = require("../../middlewares/verifyToken");

router.get("/:productId/barcodes", verifyToken, async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const query = { "rentalItem.productID": req.params.productId };
  if (status) query.status = status;

  const total = await Barcode.countDocuments(query);

  const barcodes = await Barcode.find(query)
    .select("brID status rentalItem currentRental damagedAt")
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  res.json({
    success: true,
    barcodes,
    pagination: {
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    },
  });
});

module.exports = router;
