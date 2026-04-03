const express = require('express');
const router = express.Router();
const Cart = require('../../models/carts');
const verifyToken = require('../../middlewares/verifyToken');

router.patch('/:itemId', verifyToken, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { quantity } = req.body;
        const userId = req.user.id;

        if (!quantity || isNaN(quantity) || quantity < 1) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }

        const updatedCart = await Cart.findOneAndUpdate(
            { user: userId, 'items._id': itemId },
            { $set: { 'items.$.quantity': quantity } },
            { new: true }
        );

        if (!updatedCart) {
            return res.status(404).json({ message: 'Cart item not found' });
        }

        res.status(200).json({ message: 'Quantity updated successfully', cart: updatedCart });
    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;