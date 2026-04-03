const express = require('express');
const router = express.Router();
const Query = require('../../models/query');
const verifyToken = require('../../middlewares/verifyToken');

router.get('/',verifyToken, async (req, res) => {
    try {
        // Fetch all queries with user details
        const populatedQueries = await Query.find()
            .populate('userId', 'phone') // Populate only the phone field from the user document
            .lean(); // Convert to plain JavaScript objects

        

        // Map over the queries to construct the response objects
        const response = populatedQueries.map(query => ({
            _id: query._id,
            userId: query.userId._id,
            message: query.message,
            email: query.email,
            name: query.name,
            complaintId: query.complaintId,
            date: query.date,
            phone: query.userId.phone,
            status: query.status
        }));

        res.status(200).json({ success: true, data: response });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;