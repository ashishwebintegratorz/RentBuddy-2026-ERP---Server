const express = require('express');
const router = express.Router();
const Product = require('../../models/product');
const verifyToken = require('../../middlewares/verifyToken');
const mongoose = require('mongoose');

// Edit Product by ID
router.put('/', verifyToken, async (req, res) => {
    const { _id } = req.body

    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        // Find and update the product with req.body
        const updatedProduct = await Product.findByIdAndUpdate(
            _id,
            { ...req.body }, // Spread req.body to update all fields
            { new: true } // Returns the updated document
        );

        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({ success: true, message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
