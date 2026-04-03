const express = require('express');
const router = express.Router();
const Invoice = require('../../models/invoice');
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    try {
        const invoiceData = {
            billingInfo: req.body.billingInfo,
            items: req.body.items,
            userEmail: req.user.email,
            totalAmount: req.body.totalAmount,
            depositAmount: req.body.depositAmount,
            paymentType: req.body.paymentType,
            orderNotes: req.body.orderNotes,
            cgst: req.body.cgst,
            igst: req.body.igst,
            productRent: req.body.productRent,
            couponCode: req.body.couponCode,
            paymentMethod: req.body.paymentMethod,
            orderId: req.body.orderId,
        };

        const newInvoice = new Invoice(invoiceData);
        await newInvoice.save();

        res.status(201).send({ success: true, message: "Invoice created successfully!", invoice: newInvoice });
    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "An error occurred while creating the invoice." });
    }
});

module.exports = router;
