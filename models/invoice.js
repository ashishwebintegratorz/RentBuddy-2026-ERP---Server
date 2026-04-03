// models/invoice.js
const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const InvoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    userEmail: {
        type: String,
        required: true
    },

    invoice_number: {
        type: String,
        unique: true
    },

    created_at: {
        type: Date,
        default: Date.now
    },

    billingInfo: {
        firstName: String,
        lastName: String,
        phone: String,
        address: String,
        landmark: String,
        town: String,
        state: String,
        postcode: String,
        emiDate: String
    },
    items: [
        {
            itemType: {
                type: String,
                enum: ['product', 'package'],
                default: 'product',
                required: true
            },
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: function () { return this.itemType === 'product'; }
            },
            packageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Package',
                required: function () { return this.itemType === 'package'; }
            },
            quantity: Number,
            price: Number,
            productSerialId: String,
            serialNumber: String,
            rentalDuration: String,
            productName: String // Added to support package name storage if needed
        }
    ],

    totalAmount: Number,
    depositAmount: Number,
    paymentType: String,
    paymentMethod: String,

    cgst: Number,
    igst: Number,
    productRent: Number,
    couponCode: String,

    // 🔗 ORDER LINK
    orderId: {
        type: String,
        required: true
    },
    orderInternalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }
}, {
    timestamps: true,
    id: false // Disable the 'id' virtual to avoid any confusion/conflicts
});

InvoiceSchema.plugin(AutoIncrement, { inc_field: 'invoice_seq' });

// Set invoice_number before save based on the sequence (if possible) or just use sequence
InvoiceSchema.pre('save', function (next) {
    if (this.isNew && !this.invoice_number) {
        // Since AutoIncrement hasn't run yet, we can't get the exact seq here easily 
        // without a query, but the plugin will set invoice_seq.
        // We can use a post-save hook or just use the seq in the frontend.
        // However, many parts of the app might expect invoice_number to be set.
    }
    next();
});

// Use a virtual or just rely on the fact that we can set it in a post-save hook
InvoiceSchema.post('save', async function (doc) {
    if (!doc.invoice_number && doc.invoice_seq) {
        doc.invoice_number = `INV_${doc.invoice_seq}`;
        await mongoose.model('Invoice').updateOne({ _id: doc._id }, { invoice_number: doc.invoice_number });
    }
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);

// Self-healing: Automatically drop legacy id_1 index if it exists on the collection
Invoice.on('index', function (err) {
    if (err) console.error('Invoice index error:', err);
});

// Use an async IIFE or just a background check to drop problematic index across different DBs
setTimeout(async () => {
    try {
        const indexes = await Invoice.collection.indexes();
        if (indexes.some(idx => idx.name === 'id_1')) {
            console.log('[Invoice Model] Dropping legacy id_1 index found in database...');
            await Invoice.collection.dropIndex('id_1');
        }
    } catch (e) {
        // Ignore errors if index doesn't exist or collection isn't ready
    }
}, 5000);

module.exports = Invoice;
