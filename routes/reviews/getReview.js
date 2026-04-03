const express = require('express');
const router = express.Router();
const Review = require('../../models/review');
const mongoose = require('mongoose');

// Helper function to format reviews
const formatReviews = (reviews) => {
    return reviews.map(review => ({
        reviewId: review._id,
        reviewText: review.reviewText,
        date: review.date,
        productId: review.productId,
        user: review.userId ? {
            userId: review.userId._id,
            username: review.userId.username,
            email: review.userId.email,
            profilePic: review.userId.profilePic
        } : []
    }));
};

// Get reviews for a specific product
router.get('/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const reviews = await Review.find({ productId })
            .populate('userId', 'username email profilePic')
            .sort({ date: -1 })
            .exec();

        if (!reviews || reviews.length === 0) {
            return res.status(200).json({ success: false, message: 'No reviews found for this product' });
        }

        const formattedReviews = formatReviews(reviews);

        res.status(200).json({ 
            success: true, 
            data: formattedReviews,
            message: 'Reviews fetched successfully'
        });

    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get all reviews
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const totalReviews = await Review.countDocuments();
        const totalPages = Math.ceil(totalReviews / limit);

        const reviews = await Review.find()
            .populate('userId', 'username email profilePic')
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .exec();

        if (!reviews || reviews.length === 0) {
            return res.status(200).json({ success: false, message: 'No reviews found' });
        }

        const formattedReviews = formatReviews(reviews);

        res.status(200).json({ 
            success: true, 
            data: formattedReviews,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalReviews: totalReviews
            },
            message: 'Reviews fetched successfully'
        });

    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
