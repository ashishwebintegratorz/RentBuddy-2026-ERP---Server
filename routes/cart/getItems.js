const express = require('express');
const router = express.Router();
const Cart = require('../../models/carts');
const verifyToken = require('../../middlewares/verifyToken');

router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId
        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('items.packageId');
        

        if (!cart) {
            return res.status(200).json({ success: false, message: 'Cart not found', length: 0 });
        }
        console.log('Fetched cart:', cart);
        res.status(200).json({ success: true, data: cart, length: cart.items.length });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).json({ success: false, message: 'Error fetching cart items', error: error.message, length: 0 });
    }
});

module.exports = router;