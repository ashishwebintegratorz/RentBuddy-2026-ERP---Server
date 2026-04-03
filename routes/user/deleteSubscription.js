const express = require('express');
const router = express.Router();
const Subscribe = require('../../models/subscription');
const verifyToken = require('../../middlewares/verifyToken');


router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const {id} = req.params;
        await Subscribe.findByIdAndDelete(id).then((response) => {
            return res.status(200).json({success: true, message: 'Subscription deleted successfully'})
        })
    } catch (error) {
        return res.status(500).json({success: false, message: 'Internal Server Error'}) 
    }
})


module.exports = router;