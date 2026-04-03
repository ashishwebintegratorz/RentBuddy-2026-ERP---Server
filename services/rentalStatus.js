// utils/rentalStatus.js
const Rental = require('../models/rentalProducts');

async function checkRentalCompletion(rentalId) {
    const rental = await Rental.findById(rentalId);
    if (!rental) {
        throw new Error('Rental not found');
    }

    const now = new Date();
    const isExpired = now > new Date(rental.rentedTill);
    const isPaid = rental.paymentsMade >= rental.totalPaymentsRequired;

    let status = 'active';
    if (isPaid) {
        status = 'completed';
    } else if (isExpired) {
        status = 'expired';
    }

    if (status !== rental.rentalStatus) {
        rental.rentalStatus = status;
        if (status === 'completed' && rental.subscriptionId) {
            rental.subscriptionStatus = 'completed';
        }
        await rental.save();
    }

    return status;
}

async function updateNextBillingDate(rentalId) {
    const rental = await Rental.findById(rentalId);
    if (!rental || rental.rentalStatus === 'completed') {
        return;
    }

    const billingDay = rental.originalBillingDay;
    const today = new Date();
    let nextBillingDate = new Date(today.getFullYear(), today.getMonth(), billingDay);

    if (today.getDate() >= billingDay) {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    // Handle month overflow (e.g., Jan 31 + 1 month)
    while (nextBillingDate.getDate() !== billingDay) {
        nextBillingDate.setDate(nextBillingDate.getDate() - 1);
    }

    rental.nextBillingDate = nextBillingDate;
    await rental.save();
}

module.exports = { checkRentalCompletion, updateNextBillingDate };