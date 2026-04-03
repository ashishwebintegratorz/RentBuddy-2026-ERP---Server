const express = require('express');
const router = express.Router();
const Wishlist = require('../../models/wishlist')
const verifyToken = require('../../middlewares/verifyToken');

router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;


        const wishlist = await Wishlist.findOne({ userId });
        // console.log(wishlist)

        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found' });
        }

        res.status(200).json(wishlist);
    } catch (error) {
        console.error('Error getting wishlist:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/removeFromWishlist/:itemId', verifyToken, async (req, res) => {
    try {
      const { userId } = req.user;
      const { itemId } = req.params;
  
      const wishlist = await Wishlist.findOne({ userId });
  
      if (!wishlist) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
  
      // Remove the item from the wishlist
      wishlist.items = wishlist.items.filter(item => item._id.toString() !== itemId);
  
      await wishlist.save();
  
      res.status(200).json({ message: 'Item removed from wishlist', wishlist });
    } catch (error) {
      console.error('Error removing item from wishlist:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

module.exports = router;