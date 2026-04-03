const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Package = require("../../models/package");
const verifyToken = require("../../middlewares/verifyToken");

router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log("TOGGLE PACKAGE ID:", id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid package id" });
    }

    const pack = await Package.findById(id);
    if (!pack) {
      return res.status(404).json({ message: "Package not found" });
    }

    pack.isActive = !pack.isActive;
    await pack.save();

    res.json({
      success: true,
      message: `Package ${pack.isActive ? "activated" : "deactivated"}`,
      isActive: pack.isActive,
    });
  } catch (err) {
    console.error("Toggle package error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
