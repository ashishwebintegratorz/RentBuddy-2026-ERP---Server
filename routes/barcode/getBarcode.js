const express = require("express");
const router = express.Router();
const Barcode = require("../../models/barcode");
const verifyToken = require("../../middlewares/verifyToken");

router.get("/:barcodeId", verifyToken, async (req, res) => {
  const barcode = await Barcode.findById(req.params.barcodeId)
    .populate("currentRental.customerID", "name email")
    .populate("currentRental.orderID")
    .lean();

  if (!barcode) {
    return res.status(404).json({ success: false });
  }

  res.json({ success: true, barcode });
});

module.exports = router;
