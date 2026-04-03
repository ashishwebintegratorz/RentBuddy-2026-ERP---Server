const express = require('express');
const router = express.Router();
const Repair = require('../../models/repairProducts')

router.get('/', async (req, res) => {
    try {
        await Repair.find().then((obj) => {
            res.status(200).json({ success: true, message: obj })
        })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add repair', error: error.message });
    }
});

module.exports = router;