const express = require("express");
const router = express.Router();
const Product = require("../../models/product");
const verifyToken = require("../../middlewares/verifyToken");

router.get("/:productId", verifyToken, async (req, res) => {
  const product = await Product.findById(req.params.productId).lean();
  if (!product || product.isDeleted) {
    return res.status(404).json({ success: false });
  }
  res.json({ success: true, product });
});

module.exports = router;
