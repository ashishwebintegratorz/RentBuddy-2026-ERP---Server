const mongoose = require('mongoose');

const PackageCartSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    rentalDuration: {
        type: String,
        required: true
    },
    rent: {
        type: Number,
        required: true
    }
});

const PackageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [PackageCartSchema]
});

module.exports = mongoose.model('packageCart', PackageSchema);