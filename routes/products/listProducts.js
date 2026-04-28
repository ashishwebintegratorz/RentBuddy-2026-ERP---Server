const express = require("express");
const router = express.Router();
const Product = require("../../models/product");
const Barcode = require("../../models/barcode");
const verifyToken = require("../../middlewares/verifyToken");
const mongoose = require("mongoose");

router.get("/", async (req, res) => {
  try {
    // 1️⃣ Fetch products
    const products = await Product.find()
      .select("_id productName category image city rentalPrice deposit stocks")
      .lean();

    // 2️⃣ Collect ObjectIds correctly
    const productIds = products.map(p => new mongoose.Types.ObjectId(p._id));

    // 3️⃣ Aggregate barcode stats
    const stats = await Barcode.aggregate([
      {
        $match: {
          "rentalItem.productID": { $in: productIds },
        },
      },
      {
        $group: {
          _id: {
            pid: "$rentalItem.productID",
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // 4️⃣ Build lookup map
    const map = {};
    stats.forEach(s => {
      const pid = s._id.pid.toString();
      if (!map[pid]) map[pid] = {};
      map[pid][s._id.status] = s.count;
    });

    // 5️⃣ Attach stats to products
    const result = products.map(p => {
      const pid = p._id.toString();
      return {
        ...p,
        available: map[pid]?.available || 0,
        rented: map[pid]?.rented || 0,
        damaged: map[pid]?.damaged || 0,
        maintenance: map[pid]?.maintenance || 0,
        retired: map[pid]?.retired || 0,
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Product list error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
