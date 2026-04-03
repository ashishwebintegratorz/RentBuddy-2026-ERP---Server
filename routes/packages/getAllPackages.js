const express = require("express");
const router = express.Router();
const Package = require("../../models/package");

router.get("/", async (req, res) => {
  try {
    const { city, activeOnly = true } = req.query;

    const filter = {};
    if (city) filter.city = city;
    if (activeOnly === "true") filter.isActive = true;

    const packages = await Package.find(filter)
      .populate("items.product", "productName rentalPrice image")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: packages.length,
      data: packages,
    });
  } catch (err) {
    console.error("Get packages error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
