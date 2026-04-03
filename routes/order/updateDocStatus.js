const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const router = express.Router();
const Document = require('../../models/documents');

router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { status } = req.body;

        // Check if the status is provided
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Update the document's status
        const response = await Document.findByIdAndUpdate(
            req.params.id,
            { $set: { status: status } },
            { new: true } // Returns the updated document
        );

        // Check if the document was found and updated
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        // Send success response
        res.status(200).json({
            success: true,
            message: 'Document status updated successfully',
            data: response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating document status',
            error: error.message
        });
    }
});

module.exports = router;
