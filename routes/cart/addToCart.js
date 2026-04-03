const express = require('express');
const router = express.Router();
const Cart = require('../../models/carts');
const Product = require('../../models/product'); 
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    try {
        const { productId, packageId, quantity, rentalDuration, price } = req.body;
        const userId = req.user.userId;

        let product = null;
        let pkg = null;
        let itemType = 'product';

        // 1. Identify what we are adding
        if (packageId) {
            itemType = 'package';
            pkg = await require('../../models/package').findById(packageId);
            if (!pkg) return res.status(404).json({ message: 'Package not found' });
        } else if (productId) {
            itemType = 'product';
            product = await Product.findById(productId);
            if (!product) return res.status(404).json({ message: 'Product not found' });
        } else {
            return res.status(400).json({ message: 'Either productId or packageId is required' });
        }
        
        // 2. Find or Create Cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        // 3. Format Price
        const formattedPrice = Number(parseFloat(price).toFixed(2));

        // 4. Check if item exists in cart
        let existingItemIndex = -1;
        if (itemType === 'package') {
            existingItemIndex = cart.items.findIndex(item => 
                item.itemType === 'package' && item.packageId && item.packageId.toString() === packageId
            );
        } else {
            existingItemIndex = cart.items.findIndex(item => 
                item.itemType === 'product' && item.productId && item.productId.toString() === productId
            );
        }

        if (existingItemIndex > -1) {
            // Update existing item
            cart.items[existingItemIndex].quantity += quantity;
            // Optionally update rent if it changed (though usually price comes from frontend/backend source of truth)
            cart.items[existingItemIndex].rent = formattedPrice; 
        } else {
            // Add new item
            const newItem = {
                itemType,
                quantity,
                rentalDuration,
                rent: formattedPrice,
            };

            if (itemType === 'package') {
                newItem.packageId = packageId;
                newItem.name = pkg.packageName; // or just 'packageName'
                newItem.image = pkg.image || ''; // Ensure package model has image field or handle fallback
            } else {
                newItem.productId = productId;
                newItem.name = product.productName;
                newItem.image = product.image;
            }

            cart.items.push(newItem);
        }

        await cart.save();
        console.log('Cart after addition:', JSON.stringify(cart, null, 2));
        res.status(200).json(cart);
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ message: 'Error adding to cart', error: error.message });
    }
});

module.exports = router;
