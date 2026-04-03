const express = require('express');
const router = express.Router();
const BillingAddress = require('../../models/BillingAddress');
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    try {
        const {firstName, lastName, phone, address, landmark, town, state, postcode} = req.body;
        // console.log(req)
        const userId = req.user.userId;
        await BillingAddress.create({
            userId,
            firstName,
            lastName,
            phone,
            address,
            landmark,
            town,
            state,
            postcode
        })
        res.status(201).json({ success: true, message: 'Billing Address saved' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
})

module.exports = router;