const express = require("express");
const router = express.Router();
const Package = require("../../models/package");

router.get("/", async (req, res) => {
  try {
    const { city, activeOnly = "true" } = req.query;

    const filter = {};
    if (city) filter.city = city;
    if (activeOnly === "true") filter.isActive = true;

    const packages = await Package.find(filter)
      .populate("items.product", "productName rentalPrice image stocks")
      .sort({ createdAt: -1 });

    // Filter packages: include only if ALL items in the package have sufficient stock
    const availablePackages = packages.filter((pkg) => {
      if (!pkg.items || pkg.items.length === 0) return false;

      return pkg.items.every((item) => {
        // If product is missing or null, consider it unavailable
        if (!item.product) return false;
        // Check if product stock is sufficient for the package quantity
        return item.product.stocks >= item.quantity;
      });
    });

    res.json({
      success: true,
      count: availablePackages.length,
      data: availablePackages,
    });
  } catch (err) {
    console.error("Get packages error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
