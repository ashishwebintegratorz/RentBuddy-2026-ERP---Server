const express = require('express');
const router = express.Router();
const Product = require('../../models/product');
const verifyToken = require('../../middlewares/verifyToken');

router.get('/', verifyToken, async(req, res) => {
    try {
        await Product.find({availability: "rented"}).then((response) => {
            res.status(200).json({success: true, data: response})
        })
        .catch((error) => {
            console.log(error);
            res.status(200).json({ success: false, message: 'No rented products found' });
        })
    } catch (error) {
        res.status(500).json({success: false, message: "Internal Server Error"})
    }
})

module.exports = router;