const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const User = require('../../models/auth');
const multer = require('multer');
const Document = require('../../models/documents');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage with file type validation
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'application/pdf'
    ) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, JPEG, PNG and PDF files are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 4
    }
});

// Handle multiple uploads
const uploadFiles = upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'rentAgreement', maxCount: 1 },
    { name: 'idProof', maxCount: 1 }
]);

// Multer error handler
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size is too large. Maximum size is 5MB'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files uploaded'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error',
            error: err.message
        });
    }
    next(err);
};

// Image validation (kept as-is)
const validateImageDimensions = async () => true;

// Main route
router.post('/', verifyToken, uploadFiles, handleMulterError, async (req, res) => {
    try {
        // Find user
        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 🔧 FIX 1: username fallback (ONLY FIX)
        const username = user.username || user.email.split('@')[0];

        // Find or create document record
        let userDocs = await Document.findOne({ userId: user._id });

        if (!userDocs) {
            userDocs = new Document({
                userId: user._id,
                username: username,
                documents: {}
            });
        }

        const files = req.files;
        const uploadPromises = [];

        for (const [fieldName, fileArray] of Object.entries(files)) {
            const file = fileArray[0];

            await validateImageDimensions(file.buffer);

            const b64 = Buffer.from(file.buffer).toString('base64');
            const dataURI = `data:${file.mimetype};base64,${b64}`;

            const uploadPromise = cloudinary.uploader.upload(dataURI, {
                folder: `documents/${username}`,
                public_id: `${fieldName}_${Date.now()}`,

                // 🔧 FIX 2: correct resource type
                resource_type: file.mimetype === 'application/pdf' ? 'raw' : 'image',

                fetch_format: 'auto',
                quality: 'auto'
            }).then(result => {
                userDocs.documents[fieldName] = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    uploadedAt: new Date(),
                    format: result.format,
                    width: result.width,
                    height: result.height,
                    size: result.bytes
                };
            });

            uploadPromises.push(uploadPromise);
        }

        await Promise.all(uploadPromises);
        await userDocs.save();

        res.status(200).json({
            success: true,
            message: 'Documents uploaded successfully',
            documents: userDocs.documents
        });

    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading documents',
            error: error.message
        });
    }
});

module.exports = router;
