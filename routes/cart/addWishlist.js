const express = require('express');
const router = express.Router();
const Wishlist = require('../../models/wishlist')
const Product = require('../../models/product');
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user.userId;
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        }
    
        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
          wishlist = new Wishlist({ userId, items: [] });
        }
    
        const itemExists = wishlist.items.some(item => item.productId.toString() === productId);
        if (itemExists) {
          return res.status(400).json({ message: 'Item already in wishlist' });
        }
    
        wishlist.items.push({
          productId: product._id,
          title: product.productName,
          price: product.rentalPrice,
          image: product.image
        });
    
        await wishlist.save();
    
        res.status(200).json({ message: 'Item added to wishlist', wishlist });
      } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ message: 'Server error' });
      }
});

module.exports = router;