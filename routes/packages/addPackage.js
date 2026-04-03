const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const Package = require("../../models/package");
const Product = require("../../models/product");
const verifyToken = require("../../middlewares/verifyToken");

const upload = multer({ storage: multer.memoryStorage() });
router.get("/__test", (req, res) => {
  res.send("PACKAGE ROUTE HIT");
});

router.post(
  "/",
  verifyToken,

  upload.single("packageImage"),
  async (req, res) => {
    try {
      const {
        packageName,
        description,
        items,
        monthlyPrice,
        depositAmount,
        allowedDurations,
        city,
      } = req.body;

      if (!packageName || !items || !monthlyPrice) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const parsedItems = JSON.parse(items);

      // validate products
      for (const it of parsedItems) {
        const exists = await Product.findById(it.product);
        if (!exists) {
          return res
            .status(400)
            .json({ message: `Invalid product ${it.product}` });
        }
      }

      let imageUrl = null;
      if (req.file) {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: "rentbuddy packages" },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          ).end(req.file.buffer);
        });
        imageUrl = uploadResult.secure_url;
      }

      const pack = await Package.create({
        packageName,
        description,
        items: parsedItems,
        monthlyPrice,
        depositAmount,
        allowedDurations: allowedDurations
          ? JSON.parse(allowedDurations)
          : [3, 6, 12],
        city,
        image: imageUrl,
        createdBy: req.user.userId,
      });

      return res.status(201).json({
        success: true,
        message: "Package created successfully",
        data: pack,
      });
    } catch (err) {
      console.error("Add package error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

module.exports = router;
