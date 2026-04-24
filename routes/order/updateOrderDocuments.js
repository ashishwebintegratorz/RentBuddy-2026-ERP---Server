const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const Order = require('../../models/orders');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadFiles = upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'rentAgreement', maxCount: 1 },
    { name: 'idProof', maxCount: 1 }
]);

router.post('/:orderId', verifyToken, uploadFiles, async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        console.log("--- DEBUG START ---");
        console.log("Updating docs for order:", orderId);
        console.log("Files received:", req.files ? Object.keys(req.files) : []);
        console.log("Body fields:", Object.keys(req.body || {}));
        console.log("--- DEBUG END ---");

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if documents are already verified
        if (order.documentStatus === 'verified') {
            return res.status(400).json({ 
                success: false, 
                message: 'Documents are already verified and cannot be changed.' 
            });
        }

        const files = req.files;
        if (!files || Object.keys(files).length === 0) {
            console.log("No files found in request");
            return res.status(400).json({ success: false, message: 'No documents provided for update' });
        }

        const uploadPromises = [];
        const updatedDocuments = {};

        for (const [fieldName, fileArray] of Object.entries(files)) {
            const file = fileArray[0];
            const b64 = Buffer.from(file.buffer).toString('base64');
            const dataURI = `data:${file.mimetype};base64,${b64}`;

            const isPDF = file.mimetype === 'application/pdf';
            console.log(`Uploading ${fieldName} to Cloudinary...`);
            
            const uploadPromise = cloudinary.uploader.upload(dataURI, {
                folder: `orders/${orderId}/documents`,
                public_id: isPDF ? `${fieldName}_${Date.now()}.pdf` : `${fieldName}_${Date.now()}`,
                resource_type: isPDF ? 'raw' : 'auto',
                ...(isPDF ? {} : { fetch_format: 'auto', quality: 'auto' })
            }).then(result => {
                console.log(`Cloudinary upload success for ${fieldName}:`, result.secure_url);
                updatedDocuments[fieldName] = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    uploadedAt: new Date()
                };
            });

            uploadPromises.push(uploadPromise);
        }

        await Promise.all(uploadPromises);
        console.log("All Cloudinary uploads completed. Updating database...");
        
        // 1. Update Order record
        // Initialize documents if it doesn't exist
        if (!order.documents) order.documents = {};
        
        for (const [fieldName, docData] of Object.entries(updatedDocuments)) {
            if (docData && docData.url) {
                console.log(`Applying update to order documents field: ${fieldName}`);
                order.documents[fieldName] = docData;
            }
        }

        order.markModified('documents');
        order.documentStatus = 'pending';
        const savedOrder = await order.save();
        console.log("Order record saved successfully. New status:", savedOrder.documentStatus);

        // 2. Sync with global Document record for the user
        const DocumentModel = require('../../models/documents');
        let userDocs = await DocumentModel.findOne({ userId: order.userId });
        
        if (!userDocs) {
            console.log("Global Document record not found. Creating new one...");
            const User = require('../../models/auth');
            const user = await User.findById(order.userId);
            userDocs = new DocumentModel({
                userId: order.userId,
                username: user?.username || 'User',
                documents: {}
            });
        }

        for (const [fieldName, docData] of Object.entries(updatedDocuments)) {
            if (docData && docData.url) {
                userDocs.documents[fieldName] = docData;
            }
        }
        userDocs.markModified('documents');
        userDocs.status = 'pending';
        await userDocs.save();
        console.log("Global Document record synced.");

        res.status(200).json({
            success: true,
            message: 'Documents updated successfully',
            data: savedOrder.documents,
            status: savedOrder.documentStatus
        });

    } catch (error) {
        console.error('Update documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating documents',
            error: error.message
        });
    }
});

module.exports = router;
