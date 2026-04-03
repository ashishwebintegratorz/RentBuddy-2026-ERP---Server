const express = require('express');
const router = express.Router();
const Product = require("../../models/product");

/**
 * Update duration discounts for a product
 * This only updates the durationsDiscount field and keeps all inventory logic intact.
 */
router.put("/:id", async (req, res) => {
    const productId = req.params.id;
    const { threeMonths, sixMonths, twelveMonths } = req.body;

    try {
        // Build update object dynamically (so empty fields don't overwrite previous discounts)
        const updateData = {};

        if (threeMonths !== undefined)
            updateData["durationsDiscount.threeMonths"] = threeMonths;

        if (sixMonths !== undefined)
            updateData["durationsDiscount.sixMonths"] = sixMonths;

        if (twelveMonths !== undefined)
            updateData["durationsDiscount.twelveMonths"] = twelveMonths;

        // No fields provided?
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                message: "No discount fields provided for update.",
            });
        }

        // Update product safely
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Duration discounts updated successfully",
            product: updatedProduct
        });

    } catch (err) {
        console.error("Duration discount update error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message
        });
    }
});

module.exports = router;
