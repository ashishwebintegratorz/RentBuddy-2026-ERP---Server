const express = require("express");
const router = express.Router();
const Package = require("../../models/package");
const verifyToken = require("../../middlewares/verifyToken");

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const pack = await Package.findByIdAndDelete(req.params.id);

    if (!pack) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.json({
      success: true,
      message: "Package permanently deleted",
    });
  } catch (err) {
    console.error("Delete package error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
