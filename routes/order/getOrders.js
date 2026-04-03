const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const verifyToken = require("../../middlewares/verifyToken");
const Order = require("../../models/orders");
const User = require("../../models/auth");

router.get("/", verifyToken, async (req, res) => {
    try {
        let {
            page = 1,
            limit = 10,
            search = "",
            startDate,
            endDate,
            state,
            city,
            status,
        } = req.query;

        page = Number(page);
        limit = Number(limit);

        const matchStage = {};

        /* ===== DATE FILTER ===== */
        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchStage.createdAt.$lte = end;
            }
        }

        /* ===== STATE FILTER ===== */
        if (state?.trim()) {
            matchStage["billingInfo.state"] = {
                $regex: state.trim(),
                $options: "i",
            };
        }

        /* ===== STATUS FILTER ===== */
        if (status?.trim()) {
            matchStage.status = {
                $regex: status.trim(),
                $options: "i",
            };
        }

        /* ===== SEARCH (OrderId + _id + Name + Email) ===== */
        if (search?.trim()) {
            const searchText = search.trim();

            const users = await User.find({
                $or: [
                    { username: { $regex: searchText, $options: "i" } },
                    { email: { $regex: searchText, $options: "i" } },
                ],
            }).select("_id");

            const userIds = users.map(
                (u) => new mongoose.Types.ObjectId(u._id)
            );

            const orConditions = [
                { orderId: { $regex: searchText, $options: "i" } },
                { userId: { $in: userIds } },
            ];

            // search by Mongo ObjectId
            if (mongoose.Types.ObjectId.isValid(searchText)) {
                orConditions.push({
                    _id: new mongoose.Types.ObjectId(searchText),
                });
            }

            matchStage.$or = orConditions;
        }

        /* ===== PIPELINE ===== */
        const pipeline = [
            { $match: matchStage },

            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },

            ...(city?.trim()
                ? [
                    {
                        $match: {
                            "productDetails.city": {
                                $regex: city.trim(),
                                $options: "i",
                            },
                        },
                    },
                ]
                : []),

            { $sort: { createdAt: -1 } },

            { $skip: (page - 1) * limit },
            { $limit: limit },
        ];

        const countPipeline = pipeline.filter(
            (s) => !s.$skip && !s.$limit
        );

        const totalResult = await Order.aggregate([
            ...countPipeline,
            { $count: "total" },
        ]);

        const total = totalResult[0]?.total || 0;

        const orders = await Order.aggregate(pipeline);

        const populatedOrders = await Order.populate(orders, [
            { path: "userId", select: "username email" },
            { path: "items.productId", select: "city" },
        ]);

        res.json({
            data: populatedOrders,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
