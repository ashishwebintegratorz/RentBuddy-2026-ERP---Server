const express = require('express');
const User = require('../../models/auth');
const verifyToken = require('../../middlewares/verifyToken');

const router = express.Router();

router.get('/:emailid', verifyToken, async (req, res) => {
    try {
        const { emailid } = req.params;
        const user = await User.findOne({ email: emailid, role: "Customer" });
        if (user) {
            res.status(200).json({ success: true, data: user });
        } else {
            res.status(200).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;