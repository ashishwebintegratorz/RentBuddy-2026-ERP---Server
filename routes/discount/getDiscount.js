const express = require('express');
const router = express.Router();
const Discount = require('../../models/discounts');

// Add Discount
router.get('/', async (req, res) => {
    try {
      const discounts = await Discount.find().populate('productId');
      res.status(200).json(discounts);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching discounts', error });
    }
  });

module.exports = router;
