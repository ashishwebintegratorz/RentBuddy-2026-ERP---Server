const GRACE_DAYS = Number(process.env.SUBSCRIPTION_GRACE_DAYS || 5);

/**
 * Returns the status of a specific billing month.
 * @param {Date} expectedDate - The date the payment was due.
 * @param {Object|null} paymentForMonth - The payment record if one exists.
 * @returns {string} - 'Paid', 'Upcoming', 'Due Today', 'In Grace', 'Overdue'
 */
function getSubscriptionStatus(expectedDate, paymentForMonth) {
    if (paymentForMonth) return 'Paid';

    const now = new Date();
    const dueZero = new Date(expectedDate);
    dueZero.setHours(0, 0, 0, 0);

    const todayZero = new Date(now);
    todayZero.setHours(0, 0, 0, 0);

    const graceUntil = new Date(dueZero);
    graceUntil.setDate(dueZero.getDate() + GRACE_DAYS);

    const todayTime = todayZero.getTime();
    const dueTime = dueZero.getTime();
    const graceTime = graceUntil.getTime();

    if (todayTime < dueTime) return 'Upcoming';
    if (todayTime === dueTime) return 'Due Today';
    if (todayTime <= graceTime) return 'In Grace';
    return 'Overdue';
}

module.exports = {
    getSubscriptionStatus,
    GRACE_DAYS
};
