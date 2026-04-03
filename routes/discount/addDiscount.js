const express = require('express');
const router = express.Router();
const Discount = require('../../models/discounts');
const verifyToken = require('../../middlewares/verifyToken');

// Add Discount
router.post('/',verifyToken, async (req, res) => {
  try {
    const { productId, discountPercentage, tenureFrom, tenureTo } = req.body;

    const newDiscount = new Discount({
      productId,
      discountPercentage,
      tenureFrom,
      tenureTo,
    });

    await newDiscount.save();
    res.status(201).json({ message: 'Discount added successfully', discount: newDiscount });
  } catch (error) {
    res.status(500).json({ message: 'Error adding discount', error });
  }
});

// Get Discounts

module.exports = router;
