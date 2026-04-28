const mongoose = require('mongoose');

const RentalSchema = new mongoose.Schema({
    rentalId: {
        type: String,
        unique: true,
        required: true,
        default: () => Math.floor(100000 + Math.random() * 900000).toString()
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true // A rental product should always be linked to an order
    },
    barcodeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Barcode'
    },
    serialNumber: {
        type: String
    },
    rentedDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    rentedTill: {
        type: Date,
        required: true
    },
    paymentsMade: {
        type: Number,
        default: 0
    },
    totalPaymentsRequired: {
        type: Number
    },
    emiDate: {
        type: String
    },
    subscriptionId: {
        type: String
    },
    subscriptionStatus: {  // New field to track subscription state
        type: String,
        enum: ['pending', 'active', 'cancelled', 'completed'],
        default: 'pending'
    },
    rentalStatus: {
        type: String,
        enum: ['active', 'completed'],
        default: 'active'
    },
    advancePayments: [{
        month: Date,
        paidOn: Date,
        transactionId: String
    }],
    emiHistory: [{
        dueDate: Date,
        method: {
            type: String,
            enum: ['auto', 'manual']
        },
        status: {
            type: String,
            enum: ['pending', 'success', 'failed']
        },
        transactionId: String,
        processedAt: Date
    }],
    paymentMode: { // You might still want to keep this if it represents the specific payment status for this rental instance
        type: String,
        enum: ['Cumulative Payment', 'Recurring Payment'], // Adjust as per your actual payment modes for a rental
        default: 'One-time'
    },
    rentalDuration: {
        type: String,
        required: true
    },
    originalBillingDay: {
        type: Number,
    },
    nextBillingDate: {
        type: Date
    },
    paymentHistory: [{
        date: Date,
        amount: Number,
        method: { type: String, enum: ['subscription', 'manual'] },
        transactionId: String,
        isEarlyPayment: {
            type: Boolean
        },
        forMonth: Date
    }],
    paymentStatus: {
        type: String,
        required: true
    },
    isContinue: {
        type: Boolean,
        default: true
    },
    complaintMessage: {
        type: String
    },
    repairStatus: {
        type: String
    }
}, {
    timestamps: true
});


// Method to check if a month is already paid
RentalSchema.methods.isMonthPaid = function (monthDate) {
    return this.emiHistory.some(payment =>
        payment.dueDate.getMonth() === monthDate.getMonth() &&
        payment.dueDate.getFullYear() === monthDate.getFullYear() &&
        payment.status === 'success'
    );
};


// Method to record manual payment
RentalSchema.methods.recordManualPayment = async function (transactionId) {
    // const session = await mongoose.startSession();
    // session.startTransaction();

    try {
        // Calculate which month this payment is for - Standardize to 1st of the month @ 00:00:00
        const paymentMonth = new Date(this.rentedDate);
        paymentMonth.setMonth(paymentMonth.getMonth() + this.paymentsMade);
        paymentMonth.setDate(1);
        paymentMonth.setHours(0, 0, 0, 0);

        // Record in advance payments
        this.advancePayments.push({
            month: paymentMonth,
            paidOn: new Date(),
            transactionId
        });

        // Record in EMI history
        this.emiHistory.push({
            dueDate: paymentMonth,
            method: 'manual',
            status: 'success',
            transactionId,
            processedAt: new Date()
        });

        this.paymentsMade += 1;

        // If this was the final payment
        if (this.paymentsMade === this.totalPaymentsRequired) {
            this.rentalStatus = 'completed';
            this.subscriptionStatus = 'completed';
        }

        // await this.save({ session });
        // await session.commitTransaction();

        return paymentMonth;
    } catch (error) {
        // await session.abortTransaction();
        throw error;
    } finally {
        // session.endSession();
    }
};


const Rental = mongoose.model('rentalProducts', RentalSchema);

module.exports = Rental;