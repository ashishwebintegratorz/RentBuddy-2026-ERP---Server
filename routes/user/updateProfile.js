const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const User = require('../../models/auth');
const verifyToken = require('../../middlewares/verifyToken');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email }).select('-password');
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { username, email, phone, city, pincode, address } = req.body;

    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.changed <= 0) {
      return res.status(403).json({ success: false, message: 'No profile changes remaining' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: req.user.email },
      {
        username,
        email,
        phone,
        city,
        pincode,
        address,
        changed: user.changed - 1
      },
      { new: true }
    ).select('-password');
    res.status(200).json({
      success: true,
      message: `Profile updated successfully. Remaining changes: ${updatedUser.changed}`,
      user: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/upload-profile-pic', verifyToken, upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "profile_pics" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const updatedUser = await User.findOneAndUpdate(
      { email: req.user.email },
      { profilePic: result.secure_url },
      { new: true }
    ).select('-password');

    res.status(200).json({ success: true, url: result.secure_url, user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error uploading image' });
  }
});

module.exports = router;