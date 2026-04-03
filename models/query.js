const mongoose = require('mongoose');

const QuerySchema = new mongoose.Schema({
    complaintId: {
        type: String,
        unique: true,
        required: true,
        default: () => Math.floor(100000 + Math.random() * 900000).toString()
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: { type: Date, default: Date.now },
    message: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'pending'
    }
});

const Query = mongoose.model('query', QuerySchema);
module.exports = Query;