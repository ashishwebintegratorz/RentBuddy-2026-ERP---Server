const express = require('express');
const router = express.Router();
const Product = require("../../models/product");
const verifyToken = require('../../middlewares/verifyToken');

router.post("/:id",verifyToken, async(req, res) =>{
    try {
        const product = await Product.findByIdAndUpdate({_id: req.params.id}, {$set: {offer: req.body}}, {new: true});
        res.status(200).json({success: true, message: "Product updated successfully"})
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Error', error: error.message });
    }
})
module.exports = router;
