// services/paymentVerification.js
const Rental = require('../models/rentalProducts');
const Payment = require('../models/payment');

async function verifyAndProcessPayment(paymentData) {
    const { rentalId, transactionId, amount, paymentMethod, paymentDate } = paymentData;
    
    const rental = await Rental.findById(rentalId);
    if (!rental) {
        throw new Error('Rental not found');
    }

    // Check if payment is for a future month
    const paymentMonth = new Date(paymentDate);
    if (rental.isMonthPaid(paymentMonth)) {
        throw new Error('This month is already paid');
    }

    // Record payment based on method
    if (paymentMethod === 'manual') {
        await rental.recordManualPayment(transactionId);
    } else {
        rental.paymentsMade += 1;
        rental.emiHistory.push({
            dueDate: paymentMonth,
            method: 'auto',
            status: 'success',
            transactionId,
            processedAt: new Date()
        });
    }

    // Check for completion
    if (rental.paymentsMade === rental.totalPaymentsRequired) {
        rental.rentalStatus = 'completed';
        rental.subscriptionStatus = 'completed';
        
        if (rental.subscriptionId) {
            await cashfree.cancelSubscription(rental.subscriptionId);
        }
    }

    await rental.save();
    
    return {
        success: true,
        paymentsMade: rental.paymentsMade,
        totalPayments: rental.totalPaymentsRequired,
        status: rental.rentalStatus
    };
}

module.exports = { verifyAndProcessPayment };