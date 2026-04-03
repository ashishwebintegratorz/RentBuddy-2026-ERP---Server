const express = require('express');
const router = express.Router();
const Review = require('../../models/review');
const User = require('../../models/auth'); // Import the User model
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', verifyToken, async (req, res) => {
  try {
    const { reviewText, productId } = req.body;
    const email = req.email; // Get the email from the request

    // Fetch the user using the email
    const user = await User.findOne({ email });

    if (user) {
      await Review.create({
        reviewText,
        productId,
        userId: user._id, // Use the user's _id
      });
      res.status(201).json({ success: true, message: 'Review created successfully' });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;