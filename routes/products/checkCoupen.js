const express = require('express');
const router = express.Router();
const Product = require("../../models/product");

router.post("/", async (req, res) => {
    try {
        const { couponCode, productId } = req.body
        const product = await Product.findById({ _id: productId });
        if (product) {
            if (product?.offer?.offerCode === couponCode) {
                res.status(200).json({ success: true, message: "Coupen Applied!!", discount: product?.offer?.discount });
            }
            else {
                res.status(200).json({ success: false, message: "Invalid coupon" });
            }
        }
    } catch (error) {

    }
})
module.exports = router;
