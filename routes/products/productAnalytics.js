const Product = require("../../models/product");
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();

router.get ('/', async (req, res) => {
  try {
    /* -------------------------------
       BASIC COUNTS
    ---------   -----------------------*/
    const totalProducts = await Product.countDocuments();

    const totalStockCount = await Product.aggregate([
      { $group: { _id: null, total: { $sum: "$stocks" } } }
    ]);

    const outOfStockCount = await Product.countDocuments({ stocks: { $lte: 0 } });

    /* -------------------------------
       PRODUCTS BY CATEGORY
    --------------------------------*/
    const productsByCategory = await Product.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $or: [{ $eq: ["$category", null] }, { $eq: ["$category", ""] }] },
              "Unknown",
              "$category",
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    /* -------------------------------
       PRODUCTS BY CITY
    --------------------------------*/
    const productsByCity = await Product.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $or: [{ $eq: ["$city", null] }, { $eq: ["$city", ""] }] },
              "Unknown",
              "$city",
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    /* ------------------------------------
       TOP RENTED PRODUCTS (BY rentCount)
    --------------------------------------*/
    const topRentedProducts = await Product.find()
      .sort({ rentCount: -1 })
      .limit(5)
      .select("productName rentCount image category");

    /* -------------------------------
       LATEST PRODUCTS ADDED
    --------------------------------*/
    const latestProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("productName category image createdAt");

    /* ----------------------------------------
       MONTHLY PRODUCT ADDITIONS (LAST 12 MONTHS)
    -----------------------------------------*/
    const monthlyStats = await Product.aggregate([
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlyGrowth = monthlyStats.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      label: `${new Date(m._id.year, m._id.month - 1).toLocaleString("en-US", {
        month: "short",
      })} ${m._id.year}`,
      count: m.count,
    }));

    /* -------------------------------
       FINAL RESPONSE STRUCTURE
    --------------------------------*/
    res.status(200).json({
      success: true,
      analytics: {
        summary: {
          totalProducts,
          totalStockCount: totalStockCount[0]?.total || 0,
          outOfStockCount,
        },
        categoryBreakdown: productsByCategory.map((i) => ({
          category: i._id,
          count: i.count,
        })),
        cityBreakdown: productsByCity.map((i) => ({
          city: i._id,
          count: i.count,
        })),
        topRentedProducts,
        latestProducts,
        monthlyGrowth,
      },
    });
  } catch (error) {
    console.error("Error fetching product analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product analytics",
    });
  }
});

module.exports =router;
