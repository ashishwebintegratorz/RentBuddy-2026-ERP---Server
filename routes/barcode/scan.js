const express = require('express');
const router = express.Router();
const Barcode = require('../../models/barcode');
const RentalHistory = require('../../models/rentalHistory');
const Product = require('../../models/product');
const verifyToken = require('../../middlewares/verifyToken');

router.get('/:brID', verifyToken, async (req, res) => {
  try {
    const { brID } = req.params;
    const barcode = await Barcode.findOne({ brID })
      .populate('currentRental.customerID', 'username email phone')
      .populate('rentalHistory.customerID', 'username email phone')
      .lean();

    if (!barcode) return res.status(404).json({ ok: false, message: 'Barcode not found' });

    // product summary
    const product = await Product.findById(barcode.rentalItem.productID).lean();

    // full history count and last N rows from RentalHistory collection
    const historyCount = await RentalHistory.countDocuments({ brID }).catch(() => 0);
    const lastHistory = await RentalHistory.find({ brID })
      .sort({ rentedDate: -1 })
      .limit(20)
      .populate('customerID', 'username email phone')
      .populate('orderID', 'orderId')
      .lean();

    return res.json({
      ok: true,
      brID: barcode.brID,
      barcodeImg: barcode.barcodeImg ? `data:image/png;base64,${barcode.barcodeImg}` : null,
      status: barcode.status,
      rentalItem: barcode.rentalItem,
      currentRental: barcode.currentRental,
      rentalHistorySummary: barcode.rentalHistory || [],
      rentalHistoryCount: historyCount,
      rentalHistory: lastHistory,
      productSummary: {
        _id: product ? product._id : null,
        productName: product ? product.productName : barcode.rentalItem.productName,
        rentCount: product ? product.rentCount : null,
        availability: product ? product.availability : null
      }
    });
  } catch (err) {
    console.error('[scan] err', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
