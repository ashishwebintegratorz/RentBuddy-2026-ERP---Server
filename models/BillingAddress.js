const mongoose = require('mongoose');

const BillingSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    firstName: { type: String, required: true},
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    state: { type: String, required: true },
    postcode: { type: String, required: true },
    town: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('billing', BillingSchema);