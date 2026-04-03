const express = require('express');
const router = express.Router();
const Query = require('../../models/query');
const User = require('../../models/auth');
const verifyToken = require('../../middlewares/verifyToken');

router.post('/',  async (req, res) => {
    try {
        const { message, email, name } = req.body;

        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(200).json({ error: 'User not found' });
        }

        // Create the complaint
        const query = await Query.create({
            userId: user._id,
            message,
            email,
            name
        });

        res.status(201).json({success: true, message: "Thankyou for your query"});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
