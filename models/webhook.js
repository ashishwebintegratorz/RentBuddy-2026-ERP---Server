const mongoose = require('mongoose');

// Define schema for storing webhook data
const webhookSchema = new mongoose.Schema({
    payload: { type: Object, required: true }, // Store the entire req.body as an object
    receivedAt: { type: Date, default: Date.now }, // Timestamp for when it was received
});

// Create a model from the schema
const Webhook = mongoose.model('Webhook', webhookSchema);

module.exports = Webhook;
