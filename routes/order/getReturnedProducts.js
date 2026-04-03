const express = require('express');
const router = express.Router();
const Product = require('../../models/product');
const Order = require('../../models/orders');
const verifyToken = require('../../middlewares/verifyToken');

router.get('/', verifyToken, async (req, res) => {
    try {
        // Fetch products with availability "Return"
        const products = await Product.find({ availability: "Return" });

        // Add OrderDetails to each product
        const productsWithOrderDetails = await Promise.all(products.map(async (product) => {
            // Find orders related to the current product
            const orders = await Order.find({ "items.productId": product._id })
                .populate({
                    path: 'userId',
                    select: 'username email phone customerId isSubscribed profilePic subcriptionId',
                    populate: {
                        path: 'subcriptionId',
                        model: 'subscription',
                        select: '-__v'
                    }
                })
                .populate({
                    path: 'invoiceId',
                    model: 'Invoice',
                    select: '-__v'
                })
                .populate({
                    path: 'paymentId',
                    model: 'Payment',
                    select: '-__v'
                })
                .populate({
                    path: 'items.productId',
                    model: 'Product',
                    select: 'productName description rentalPrice productId category'
                })
                .lean()
                .exec();

            // Embed the orders into the product's OrderDetails field
            return {
                ...product.toObject(), // Convert product to plain object and spread its properties
                OrderDetails: orders.map(order => ({
                    ...order,
                    invoice: order.invoiceId,
                    payment: order.paymentId,
                    invoiceId: order.invoiceId?._id,
                    paymentId: order.paymentId?._id,
                    subscription: order.userId?.subscriptionId,
                    items: order.items.map(item => ({
                        ...item,
                        product: item.productId,
                    })),
                    // The order object now includes all populated fields
                }))
            };
        }));

        // Send the combined data in the response
        res.status(200).json({ success: true, data: productsWithOrderDetails });
    } catch (error) {
        console.error('Error fetching products with order details:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;