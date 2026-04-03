const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
    itemType: {
        type: String,
        enum: ['product', 'package'],
        default: 'product',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: function() { return this.itemType === 'product'; }
    },
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        required: function() { return this.itemType === 'package'; }
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
        required: true,
        set: v => Math.round(v * 100) / 100   // Always store 2 decimals
    },
});

const CartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [CartItemSchema]
});

// 🔥 Ensure rent is always returned with 2 decimals in API responses
CartSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.items = ret.items.map(item => ({
            ...item,
            rent: Number(item.rent.toFixed(2))
        }));
        return ret;
    }
});

module.exports = mongoose.model('Cart', CartSchema);
