const Barcode = require("../models/barcode");
const Product = require("../models/product");
const Order = require("../models/orders");

function parseMonthsFromDuration(rentalDuration = "") {
  const match = rentalDuration.match(/(\d+)\s*month/i);
  return match ? parseInt(match[1], 10) : 0;
}

async function assignBarcodesToOrder(orderId) {
  const order = await Order.findById(orderId).populate("userId");
  if (!order) throw new Error("Order not found");

  if (order.fulfilled && order.barcodeIds && order.barcodeIds.length) {
    // already assigned, nothing to do
    return order;
  }

  const userEmail =
    order.billingInfo?.email ||
    (order.userId && order.userId.email) ||
    "";

  const barcodeIdsForOrder = [];
  const now = new Date();

  for (const item of order.items || []) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    const qty = item.quantity || 1;
    const months = parseMonthsFromDuration(item.rentalDuration);
    const rentedTill = months
      ? new Date(
          now.getFullYear(),
          now.getMonth() + months,
          now.getDate()
        )
      : null;

    // get available barcodes for this product
    const freeBarcodes = await Barcode.find({
      "rentalItem.productID": product._id,
      status: "available",
    })
      .sort({ createdAt: 1 }) // assign oldest first
      .limit(qty);

    if (freeBarcodes.length < qty) {
      throw new Error(
        `Not enough available barcodes for product ${product._id}`
      );
    }

    for (const bc of freeBarcodes) {
      // update barcode -> rented
      bc.status = "rented";
      bc.rentalHistory = bc.rentalHistory || [];
      bc.rentalHistory.push({
        userId: order.userId,
        orderId: order._id,
        rentedDate: now,
        rentedTill,
        email: userEmail,
      });
      await bc.save();

      barcodeIdsForOrder.push(bc._id);

      // update product rentalHistory with same info
      await Product.findByIdAndUpdate(product._id, {
        $inc: { rentCount: 1 },
        $push: {
          rentalHistory: {
            barcodeId: bc._id,
            serial: bc.rentalItem.productSerialID, // A-0001
            rentedDate: now,
            rentedTill,
            email: userEmail,
            orderId: order._id,
          },
        },
      });
    }
  }

  order.barcodeIds = barcodeIdsForOrder;
  order.fulfilled = true;
  await order.save();

  return order;
}

module.exports = {
  assignBarcodesToOrder,
};
