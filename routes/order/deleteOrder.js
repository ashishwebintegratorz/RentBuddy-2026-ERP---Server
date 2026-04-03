// controllers/orderController.js
const express = require('express');
const router = express.Router();

const Order = require("../../models/orders");
const Invoice = require("../../models/invoice");
const Payment = require("../../models/payment");
const Rental = require("../../models/rentalProducts");
const Product = require("../../models/product");
const Barcode = require("../../models/barcode");

const deleteOrder = async (req, res) => {
  const { orderId } = req.params; // this is Order._id

  try {
    // 1️⃣ Find order by Mongo _id
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 2️⃣ Free barcodes (ObjectId match)
    const barcodes = await Barcode.find({
      "currentRental.orderID": order._id,
    });

    for (const barcode of barcodes) {
      barcode.status = "available";
      barcode.currentRental = null;
      await barcode.save();
    }

    // 3️⃣ Sync product stock
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        const availableCount = await Barcode.countDocuments({
          "rentalItem.productID": item.productId,
          status: "available",
        });

        await Product.findByIdAndUpdate(item.productId, {
          stocks: availableCount,
          availability: availableCount > 0 ? "available" : "out-of-stock",
        });
      }
    }

    // 4️⃣ Delete invoices
    await Invoice.deleteMany({ _id: { $in: order.invoiceIds } });

    // 5️⃣ Delete payments
    await Payment.deleteMany({ _id: { $in: order.paymentIds } });

    // 6️⃣ Delete rentals (ObjectId match)
    await Rental.deleteMany({ orderId: order._id });

    // 7️⃣ Delete order
    await Order.findByIdAndDelete(order._id);

    return res.status(200).json({
      message: "Order deleted successfully",
      orderId: order.orderId, // return business ID
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    return res.status(500).json({
      message: "Error deleting order",
      error: error.message,
    });
  }
};


module.exports = { deleteOrder };