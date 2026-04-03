const express = require('express');
const router = express.Router();
const Product = require('../../models/product');

router.get('/', async (req, res) => {
    try {
        const { city } = req.query; // get city from query params
        const filter = { rentCount: { $gt: 0 } };
        
        if (city) {
            filter.city = city; // add city filter if provided
        }

        // Find products where rentCount > 0 (and optionally city), sort by rentCount descending, limit to top 6
        let topRentedProducts = await Product.find(filter)
            .sort({ rentCount: -1 })
            .limit(6);

        // If no top rented products, fetch any 6 products (optionally filter by city)
        if (topRentedProducts.length === 0) {
            const fallbackFilter = {};
            if (city) fallbackFilter.city = city;

            topRentedProducts = await Product.find(fallbackFilter).limit(6);
        }

        res.status(200).json({ success: true, data: topRentedProducts });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error", error });
    }
});


module.exports = router;
