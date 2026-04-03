const express = require('express');
const router = express.Router();
const Product = require('../../models/product');
const mongoose = require('mongoose');

// GET all products with pagination + city filter
router.get('/', async (req, res) => {
  try {



    let query = {};


    const products = await Product.find()


    const totalProducts = await Product.countDocuments(query);


    res.status(200).json({
      success: true,

      totalProducts,

      count: products.length,
      data: products,
      message: products.length === 0
        ? "No products found for this city!"
        : "Products fetched successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// GET product by ID
router.get('/:id', async (req, res) => {
  try {
    const productId = new mongoose.Types.ObjectId(req.params.id);

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: "No product found with this ID!" });
    }

    res.status(200).json({ success: true, data: product });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
