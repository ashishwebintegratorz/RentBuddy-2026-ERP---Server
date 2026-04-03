const express = require('express');
const Note = require('../../models/customerNotes');
const verifyToken = require('../../middlewares/verifyToken');

const router = express.Router();

router.get('/:emailId', verifyToken, async (req, res) => {
    try {
        const email = req.params.emailId;

        // Find notes by customer email
        const customerNote = await Note.findOne({ customerEmail: email });

        if (!customerNote) {
            return res.status(200).json({ success: false, message: 'No customer notes found for this email', data: [] });
        } else {
            res.status(200).json({ success: true, data: customerNote.notes });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
