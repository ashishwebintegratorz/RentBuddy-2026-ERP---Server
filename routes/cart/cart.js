const express = require('express');
const router = express.Router()
const AddToCartRoute = require('./addToCart');
const GetCartRoute = require('./getItems');
const BillingAddressRoute = require('./billingAddress');
const WishListRoute = require('./addWishlist')
const getWishlistRoute = require('./getWishlist');
const removeCartItem = require('./removeItemFromCart');
const updateQuantity = require('./updateQuantity');


router.use("/addToCart", AddToCartRoute);
router.use("/getCart", GetCartRoute);
router.use("/billingAddress", BillingAddressRoute);
router.use("/wishlist", WishListRoute);
router.use('/getWishlist', getWishlistRoute);
router.use('/removeCartItem', removeCartItem)
router.use('/updateQuantity', updateQuantity);

module.exports = router;