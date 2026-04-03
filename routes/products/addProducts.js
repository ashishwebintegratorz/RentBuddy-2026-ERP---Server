// routes/products/addProduct.js

const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const bwipjs = require("bwip-js");

const Product = require("../../models/product");
const Barcode = require("../../models/barcode");
const verifyToken = require("../../middlewares/verifyToken");

// ✅ Configure Cloudinary (move to .env in real projects)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Fixed admin userId (for now)
const FIXED_USER_ID = "68be8c8bc50cc1e19d676374";

// 🔹 Helper: generate base64 barcode image for given text
async function generateBarcodeBase64(text) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: "center",
      },
      (err, png) => {
        if (err) return reject(err);
        const base64 = png.toString("base64"); // raw base64
        resolve(base64);
      }
    );
  });
}

// 🔹 Helper: generate unique brID
function generateBrID(index = 0) {
  return `BR-${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`;
}

// ✅ Add product route
// If you want auth, wrap with verifyToken:
// router.post('/', verifyToken, upload.single('productImage'), async (req, res) => {
router.post("/", verifyToken, upload.single("productImage"), async (req, res) => {
  try {
    const {
      productName,
      category,
      rentalPrice,
      description,
      deposit,
      costPrice,
      city,
      stock, // from frontend
    } = req.body;

    console.log("Incoming body:", req.body);
    console.log("Incoming file:", req.file);

    const totalStock = Number(stock) || 0;

    if (
      !productName ||
      !category ||
      !rentalPrice ||
      !costPrice ||
      !deposit ||
      !description
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Product image is required",
      });
    }

    // ✅ Upload image to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "rentbuddy products" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const imageUrl = uploadResult.secure_url;

    // ✅ Create product document
    const product = await Product.create({
      productName,
      category,
      rentalPrice,
      description,
      deposit,
      city,
      stocks: totalStock,
      costPrice,
      image: imageUrl,
      userId: FIXED_USER_ID,
    });

    // 🔥 Generate barcodes for each stock unit

    const barcodesToInsert = [];

    // ✅ Serial prefix from CITY: e.g. "Indore" -> "IND", "Surat" -> "SUR"
    const cityPrefix =
      (city && city.trim().slice(0, 3).toUpperCase()) || "GEN";

    for (let i = 0; i < totalStock; i++) {
      const brID = generateBrID(i);

      // e.g. IND-0001, IND-0002, SUR-0001, SUR-0002, ...
      const productSerialID = `${cityPrefix}-${String(i + 1).padStart(
        4,
        "0"
      )}`;

      // Generate barcode image from brID
      const barcodeImg = await generateBarcodeBase64(brID);

      barcodesToInsert.push({
        brID,
        barcodeImg,
        rentalItem: {
          productID: product._id,
          productSerialID,
          rentalDuration: "12 Months", // default; can be adjusted per rental later
          productName: product.productName,
          rentalPrice: product.rentalPrice,
        },
        status: "available",
        rentalHistory: [],
      });
    }

    if (barcodesToInsert.length > 0) {
      await Barcode.insertMany(barcodesToInsert);
    }

    return res.status(201).json({
      success: true,
      message: "Product and its barcodes added successfully",
      data: {
        productId: product._id,
        totalStock,
        barcodesCreated: barcodesToInsert.length,
      },
    });
  } catch (error) {
    console.error("Add product error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});



module.exports = router;
