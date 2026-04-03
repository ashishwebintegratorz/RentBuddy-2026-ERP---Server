const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const router = express.Router();
const Document = require('../../models/documents');

router.get('/', verifyToken, async (req, res) => {
    try {
        const documents = await Document.find();

        if (!documents) {
            return res.status(404).json({
                success: false,
                message: 'No documents found'
            });
        }

        res.status(200).json({
            success: true,
            documents
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching documents',
            error: error.message
        });
    }
});





module.exports = router;