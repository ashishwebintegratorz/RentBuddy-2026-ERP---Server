const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const reviewSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    reviewId: { 
        type: Number, 
        unique: true 
    },
    productId: { type: String, required: true },
    reviewText: { 
        type: String, 
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 1000
    },
    date: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

reviewSchema.plugin(AutoIncrement, { inc_field: 'reviewId' });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;