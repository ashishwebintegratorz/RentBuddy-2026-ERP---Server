// controllers/productController.js
const Product = require("../../models/product"); // your Product model

// GET /products/trackProductsRoute
const trackProducts = async (req, res) => {
  try {
    // Fetch all products
    const products = await Product.find({}); // add filters if needed

    if (!products || products.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

module.exports = {
  trackProducts,
};
