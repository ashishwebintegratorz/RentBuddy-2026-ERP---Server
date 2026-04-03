const express = require('express');
const router = express.Router();

const Repair = require('../../models/repairProducts')
const Rental = require('../../models/rentalProducts');
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', async (req, res) => {
    try {
        // console.log(req.user.userId)
        const repair = new Repair({
            ...req.body,
            userId: req.user.email // Assuming req.user.email exists and contains the user's email
        });
        await repair.save();
        await Rental.findOneAndUpdate({userId: req.user.userId}, {$set: {repairStatus: "Registered"}})
        res.status(201).json({ success: true, message: 'Repair added successfully', repair });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add repair', error: error.message });
    }
});

module.exports = router;