const mongoose = require("mongoose");
const Order = require("../models/orders");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");
const Rental = require("../models/rentalProducts");
const Product = require("../models/product");
const Cart = require("../models/carts");
const Barcode = require("../models/barcode");
const Package = require("../models/package");
const RentalHistory = require("../models/rentalHistory");
const User = require("../models/auth");

/**
 * Helper to parse months from duration string (e.g., "3 months")
 */
function getMonthsFromDurationString(duration) {
  if (!duration || typeof duration !== "string") return 0;
  const m = duration.match(
    /(\d+)\s*(month|months|year|years|week|weeks|day|days)/i
  );
  if (!m) return parseInt(duration, 10) || 0;
  const value = parseInt(m[1], 10) || 0;
  const unit = (m[2] || "").toLowerCase();
  switch (unit) {
    case "year":
    case "years":
      return Math.max(1, value * 12);
    case "month":
    case "months":
      return Math.max(1, value);
    case "week":
    case "weeks":
      return Math.max(1, Math.ceil(value / 4));
    case "day":
    case "days":
      return Math.max(1, Math.ceil(value / 30));
    default:
      return Math.max(1, value);
  }
}

/**
 * Helper to calculate the end date of a rental
 */
function calculateRentedTill(rentedDate, rentalDuration) {
  const [duration, unit] = (rentalDuration || "").split(" ");
  const durationNumber = parseInt(duration) || 0;
  const rentedTill = new Date(rentedDate);
  switch ((unit || "").toLowerCase()) {
    case "day":
    case "days":
      rentedTill.setDate(rentedTill.getDate() + durationNumber);
      break;
    case "week":
    case "weeks":
      rentedTill.setDate(rentedTill.getDate() + durationNumber * 7);
      break;
    case "month":
    case "months":
      rentedTill.setMonth(rentedTill.getMonth() + durationNumber);
      break;
    case "year":
    case "years":
      rentedTill.setFullYear(rentedTill.getFullYear() + durationNumber);
      break;
    default:
      rentedTill.setMonth(rentedTill.getMonth() + durationNumber);
  }
  return rentedTill;
}

/**
 * Core Fulfilment Logic: Assign barcodes, create invoice, update stock, finalize order.
 * This is now a shared service used by both checkout routes and webhooks.
 */
async function fulfilOrderAfterPayment(orderIdOrInternal) {
  let orderDoc = null;

  // 1) locate order
  if (mongoose.Types.ObjectId.isValid(orderIdOrInternal)) {
    orderDoc = await Order.findById(orderIdOrInternal).catch(() => null);
  }
  if (!orderDoc) {
    orderDoc = await Order.findOne({ orderId: orderIdOrInternal }).catch(
      () => null
    );
  }
  if (!orderDoc) {
    console.warn(
      "[fulfilment.service] order not found for",
      orderIdOrInternal
    );
    return;
  }

  if (orderDoc.fulfilled) {
    console.log("[fulfilment.service] already fulfilled", orderDoc._id);
    return;
  }

  const userId = orderDoc.userId;
  const billingInfo = orderDoc.billingInfo || {};
  const items = orderDoc.items || [];

  const attachedBarcodeIds = [];

  /* 1) Prepare List of "Real" Products to Fulfill (Flatten Packages) */
  const productsToFulfill = [];

  for (const item of items) {
    if (item.itemType === 'package' && item.packageId) {
      // It's a package! Expand it.
      try {
        const pkgDoc = await Package.findById(item.packageId).populate('items.product');
        if (!pkgDoc || !pkgDoc.items) {
          console.warn("[fulfilment.service] Package not found or empty:", item.packageId);
          continue;
        }

        // Add each product in the package to our list
        for (const pkgItem of pkgDoc.items) {
          if (!pkgItem.product) continue;

          productsToFulfill.push({
            productId: pkgItem.product._id,
            productName: pkgItem.product.productName,
            quantity: pkgItem.quantity || 1, 
            rentalDuration: item.rentalDuration, 
            price: 0, 
            isPackageItem: true,
            parentPackageId: pkgDoc._id
          });
        }
      } catch (err) {
        console.error("[fulfilment.service] Error expanding package:", err);
      }
    } else {
      // Normal Product
      productsToFulfill.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity || 1,
        rentalDuration: item.rentalDuration,
        price: item.price || item.rent,
        productSerialId: item.productSerialId,
        isPackageItem: false
      });
    }
  }

  /* 2) Update Stock & Assign Barcodes */
  for (const pItem of productsToFulfill) {
    const orderedProduct = await Product.findById(pItem.productId).catch(() => null);
    if (!orderedProduct) continue;

    const qty = pItem.quantity;
    orderedProduct.rentCount = (orderedProduct.rentCount || 0) + qty;
    await orderedProduct.save().catch((e) =>
      console.error("[fulfilment.service] product.save err", e)
    );
  }

  // 2b. Assign Barcodes
  for (const pItem of productsToFulfill) {
    const rentedDate = new Date();
    const rentedTill = calculateRentedTill(rentedDate, pItem.rentalDuration);
    const qty = pItem.quantity;

    for (let i = 0; i < qty; i++) {
      const barcodeQuery = {
        "rentalItem.productID": pItem.productId,
        status: "available",
      };

      if (pItem.productSerialId) {
        barcodeQuery["rentalItem.productSerialID"] = pItem.productSerialId;
      }

      let barcodeDoc = await Barcode.findOne(barcodeQuery)
        .sort({ createdAt: 1 })
        .catch(() => null);

      if (!barcodeDoc) {
        console.error(
          "[fulfilment.service] No AVAILABLE barcode found for product",
          pItem.productId
        );
        continue;
      }

      barcodeDoc.status = "rented";
      barcodeDoc.currentRental = {
        customerID: userId,
        orderID: orderDoc._id,
        rentedDate,
        rentedTill,
      };

      barcodeDoc.rentalHistory = barcodeDoc.rentalHistory || [];
      barcodeDoc.rentalHistory.push({
        customerID: userId,
        orderID: orderDoc._id,
        rentedDate,
        rentedTill,
        rentalPrice: pItem.price || 0,
        conditionAtReturn: "good",
        status: "rented",
      });

      await barcodeDoc.save().catch((e) =>
        console.error("[fulfilment.service] save barcode err", e)
      );

      attachedBarcodeIds.push(barcodeDoc._id);

      // Product rental history
      await Product.findByIdAndUpdate(pItem.productId, {
        $push: {
          rentalHistory: {
            barcodeId: barcodeDoc._id,
            serial: barcodeDoc.rentalItem.productSerialID,
            rentedDate,
            rentedTill,
            email: billingInfo?.email || "",
            orderId: orderDoc._id,
          },
        },
      }).catch((e) => console.error("[fulfilment.service] Product.rentalHistory err", e));

      // RentalHistory audit
      await RentalHistory.create({
        brID: barcodeDoc.brID,
        productID: pItem.productId,
        customerID: userId,
        orderID: orderDoc._id,
        rentedDate,
        rentedTill,
        rentalPrice: pItem.price || 0,
        conditionAtReturn: "good",
        status: "rented",
      }).catch((e) => console.error("[fulfilment.service] RentalHistory.create err", e));

      // Rental record
      const totalMonths = getMonthsFromDurationString(pItem.rentalDuration);
      await Rental.create({
        userId,
        productId: pItem.productId,
        orderId: orderDoc._id,
        barcodeId: barcodeDoc._id,
        serialNumber: barcodeDoc.rentalItem.productSerialID,
        rentalDuration: pItem.rentalDuration,
        paymentMode: orderDoc.paymentType === "Recurring Payment"
          ? "Recurring Payment"
          : "Cumulative Payment",
        paymentStatus: "Paid",
        subscriptionStatus: orderDoc.paymentType === "Recurring Payment" ? "pending" : "active",
        emiDate: billingInfo.emiDate,
        rentedDate,
        rentedTill,
        nextBillingDate: orderDoc.paymentType === "Recurring Payment"
          ? calculateRentedTill(rentedDate, "1 month")
          : null,
        totalPaymentsRequired: totalMonths || 1,
        paymentsMade: orderDoc.paymentType === "Recurring Payment" ? 1 : (totalMonths || 1),
      }).catch((e) => console.error("[fulfilment.service] Rental.create err", e));
    }

    // ⭐ Sync product stock
    try {
      const availableCount = await Barcode.countDocuments({
        "rentalItem.productID": pItem.productId,
        status: "available",
      });
      await Product.findByIdAndUpdate(pItem.productId, {
        stocks: availableCount,
        availability: availableCount > 0 ? "available" : "out-of-stock",
      });
    } catch (syncErr) {
      console.error("[fulfilment.service] stock sync err", syncErr);
    }
  }

  /* 3) create invoice if not already present */
  let invoiceDoc = await Invoice.findOne({ orderInternalId: orderDoc._id }).catch(() => null);

  if (!invoiceDoc) {
    const userDoc = await mongoose.model('User').findById(orderDoc.userId).catch(() => null);
    const userEmail = billingInfo?.email || userDoc?.email;

    if (!userEmail) {
      console.error("[fulfilment.service] Cannot create invoice: missing user email", {
        orderId: orderDoc.orderId,
        userId: userId
      });
      // We still want to mark the order as fulfilled if barcodes are assigned, 
      // but maybe throwing here to see why email is missing is better.
    }

    // Sanitize items for Invoice schema
    const invoiceItems = items.map(item => ({
      itemType: item.itemType || 'product',
      productId: item.productId,
      packageId: item.packageId,
      quantity: item.quantity,
      price: item.price || item.rent,
      productSerialId: item.productSerialId,
      serialNumber: item.serialNumber,
      rentalDuration: item.rentalDuration,
      productName: item.productName
    }));

    invoiceDoc = new Invoice({
      userId: orderDoc.userId,
      userEmail: userEmail || "no-email@provided.com", // Fallback to avoid validation error
      billingInfo,
      items: invoiceItems,
      totalAmount: orderDoc.totalAmount,
      depositAmount: orderDoc.depositAmount,
      paymentType: orderDoc.paymentType,
      orderNotes: orderDoc.orderNotes,
      cgst: orderDoc.cgst,
      igst: orderDoc.igst,
      productRent: orderDoc.productRent,
      couponCode: orderDoc.couponCode,
      paymentMethod: orderDoc.paymentMethod,
      orderId: orderDoc.orderId,
      orderInternalId: orderDoc._id
    });

    try {
      await invoiceDoc.save();
      console.log("[fulfilment.service] Invoice saved successfully:", invoiceDoc.invoice_number);
    } catch (saveError) {
      console.error("[fulfilment.service] Invoice save error:", saveError.message);
      // If save fails, we don't return the invoiceDoc to be added to order
      invoiceDoc = null; 
    }
  }

  /* 4) Finalize Order */
  orderDoc.barcodeIds = orderDoc.barcodeIds || [];
  for (const id of attachedBarcodeIds) {
    if (!orderDoc.barcodeIds.find((x) => String(x) === String(id))) {
      orderDoc.barcodeIds.push(id);
    }
  }

  orderDoc.invoiceIds = orderDoc.invoiceIds || [];
  if (invoiceDoc && !orderDoc.invoiceIds.find((x) => String(x) === String(invoiceDoc._id))) {
    orderDoc.invoiceIds.push(invoiceDoc._id);
  }

  orderDoc.fulfilled = true;
  orderDoc.paymentStatus = "Paid";
  orderDoc.status = "Completed";

  await orderDoc.save().catch((e) =>
    console.error("[fulfilment.service] order update err", e)
  );
  
  // 🔗 Link Invoice to all related Payment records for this order
  if (invoiceDoc) {
    const Payment = require('../models/payment');
    await Payment.updateMany(
      { orderId: orderDoc.orderId },
      { $set: { invoiceId: invoiceDoc._id } }
    ).catch(e => console.error("[fulfilment.service] payment invoice update err", e));
  }

  /* 5) clear cart */
  await Cart.findOneAndUpdate(
    { userId },
    { $set: { items: [] } },
    { new: true }
  ).catch(() => { });

  console.log("[fulfilment.service] fulfilment done for order", orderDoc._id);
  return { order: orderDoc, invoice: invoiceDoc };
}

module.exports = {
  fulfilOrderAfterPayment,
  getMonthsFromDurationString,
  calculateRentedTill
};
