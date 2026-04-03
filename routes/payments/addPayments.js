const express = require('express');
const verifyToken = require('../../middlewares/verifyToken');
const router = express.Router();
const Payment = require('../../models/payment')

router.post('/', verifyToken, async (req, res) => {
    try {
        const { paymentId, invoiceId, orderId, amount, paymentWay, paymentType, emiDate} = req.body;
        const customerName = req.user.username;
        const response = await Payment.create({
            paymentId,
            invoiceId,
            orderId,
            amount,
            customerName,
            paymentStatus: paymentType === 'Cumulative Payment' ? "Completed" 
                            : paymentType === 'Recurring Payment' ? "Pending" 
                            : "Failed",
            paymentMethod: paymentWay,
            paymentType,
            emiDate
        });

        res.status(200).json({ success: true, message: 'Payment added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
})

module.exports = router;