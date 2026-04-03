const express = require("express");
const router = express.Router();
const Package = require("../../models/package");

router.get("/:id", async (req, res) => {
  try {
    const pack = await Package.findById(req.params.id)
      .populate("items.product");

    if (!pack)
      return res.status(404).json({ message: "Package not found" });

    res.json({
      success: true,
      data: pack,
    });
  } catch (err) {
    console.error("Get package error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
