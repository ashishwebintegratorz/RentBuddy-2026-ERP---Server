const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const Barcode = require('../../models/barcode');
const Product = require('../../models/product')
const router = express.Router();


router.put('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { conditionAtReturn = 'good' } = req.body; // Expecting conditionAtReturn in the request body

    try {
        // Find the barcode by ID
        const updateBarcode = await Barcode.findOne({ brID: id });

        if (!updateBarcode) {
            return res.status(404).json({ message: "Barcode not found." });
        }

        updateBarcode.status = conditionAtReturn === "good" ? "available" : "damaged";
        updateBarcode.currentRental = null; // Clear the current rental information

        const lastRental = updateBarcode.rentalHistory[updateBarcode.rentalHistory.length - 1];
        lastRental.returnDate = new Date(); // Set the return date to now
        lastRental.conditionAtReturn = conditionAtReturn; // Set the condition at return

        await updateBarcode.save();

        // Sync product stock
        if (updateBarcode?.rentalItem?.productID) {
            const availableCount = await Barcode.countDocuments({
                "rentalItem.productID": updateBarcode.rentalItem.productID,
                status: "available",
            });

            await Product.findByIdAndUpdate(updateBarcode.rentalItem.productID, {
                stocks: availableCount,
                availability: availableCount > 0 ? "available" : "out-of-stock",
            });
        }

        res.status(200).json({
            message: "Barcoded product and history updated successfully.",
            data: {
                barcode: updateBarcode,
                rentalHistory: updateBarcode.rentalHistory,
            }
        });

    } catch (error) {
        console.error("Error returning barcode:", error);
        res.status(500).json({ error: "Failed to return barcode." });
    }
});



module.exports = router;