const express = require('express');
const router = express.Router();
const Product = require('../../models/product');
const Rental = require("../../models/rentalProducts")
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    try {
        const { productId, userId } = req.body;

        // Ensure both productId and userId are provided
        if (!productId || !userId) {
            return res.status(400).json({ success: false, message: "Product ID and User ID are required" });
        }

        // Update the product availability
        const productUpdateResult = await Product.findByIdAndUpdate(
            productId, 
            { $set: { availability: "Return" } },
            { new: true }  // Optionally return the updated document
        );

        if (!productUpdateResult) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Delete the rental record for the specific product and user
        const rentalDeleteResult = await Rental.findOneAndDelete({ 
            productId: productId,
            userId: userId
        });

        if (!rentalDeleteResult) {
            return res.status(404).json({ success: false, message: "Rental record not found" });
        }

        res.status(200).json({ success: true, message: "Product Returned" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});



module.exports = router;