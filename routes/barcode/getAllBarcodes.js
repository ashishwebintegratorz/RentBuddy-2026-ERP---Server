const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const Barcode = require('../../models/barcode');
const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
    try {
        // default page=1, limit=10 if not provided
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await Barcode.countDocuments();

        const barcodes = await Barcode.find()
            .populate('currentRental.customerID', 'username email phone')
            .populate('rentalHistory.customerID', 'username email phone')
            .sort({ updatedAt: -1 })   // Latest first
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            message: "Barcodes fetched successfully.",
            total,
            count: barcodes.length,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            data: barcodes,
        });

    } catch (error) {
        console.error("Error fetching barcodes:", error);
        res.status(500).json({ error: "Failed to fetch barcodes." });
    }
});

module.exports = router;
