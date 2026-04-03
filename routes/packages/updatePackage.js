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

router.put(
  "/:id",
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

      const pack = await Package.findById(req.params.id);
      if (!pack) return res.status(404).json({ message: "Package not found" });

      const parsedItems = items ? JSON.parse(items) : pack.items;

      for (const it of parsedItems) {
        const exists = await Product.findById(it.product);
        if (!exists)
          return res.status(400).json({ message: `Invalid product ${it.product}` });
      }

      let imageUrl = pack.image;
      if (req.file) {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: "rentbuddy packages" },
            (err, result) => (err ? reject(err) : resolve(result))
          ).end(req.file.buffer);
        });
        imageUrl = uploadResult.secure_url;
      }

      pack.packageName = packageName ?? pack.packageName;
      pack.description = description ?? pack.description;
      pack.items = parsedItems;
      pack.monthlyPrice = monthlyPrice ?? pack.monthlyPrice;
      pack.depositAmount = depositAmount ?? pack.depositAmount;
      pack.allowedDurations = allowedDurations
        ? JSON.parse(allowedDurations)
        : pack.allowedDurations;
      pack.city = city ?? pack.city;
      pack.image = imageUrl;

      await pack.save();

      res.json({ success: true, message: "Package updated", data: pack });
    } catch (err) {
      console.error("Update package error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

module.exports = router;
