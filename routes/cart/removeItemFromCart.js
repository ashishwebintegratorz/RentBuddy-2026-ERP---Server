const express = require('express');
const router = express.Router();
const Cart = require('../../models/carts');
const verifyToken = require('../../middlewares/verifyToken');

router.delete('/:itemId', verifyToken, async (req, res) => {
    try {
        const { itemId } = req.params;
        const userId = req.user.userId; // Assuming you have user info in req.user from authMiddleware

        // Find the user's cart
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Remove the item from the cart
        cart.items = cart.items.filter(item => item._id.toString() !== itemId);

        // Save the updated cart
        await cart.save();

        // Get the new cart length
        const newCartLength = cart.items.length;

        res.status(200).json({ 
            message: 'Item removed from cart successfully',
            newCartLength: newCartLength
        });
    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;