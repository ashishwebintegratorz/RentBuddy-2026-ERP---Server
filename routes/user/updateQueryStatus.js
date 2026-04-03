const express = require('express');
const router = express.Router();
const Query = require('../../models/query');
const verifyToken = require('../../middlewares/verifyToken');

// UPDATE complaint status
router.patch('/:complaintId/status', verifyToken, async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const query = await Query.findOneAndUpdate(
            { complaintId },
            { status },
            { new: true }
        );

        if (!query) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Complaint status updated successfully',
            data: query
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
