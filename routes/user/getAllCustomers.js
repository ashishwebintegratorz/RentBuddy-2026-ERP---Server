const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Auth = require('../../models/auth');
const Order = require('../../models/orders');
const Invoice = require('../../models/invoice');
const Subscription = require('../../models/subscription');
const RentalHistory = require('../../models/rentalHistory');
const Payment = require('../../models/payment');
const Rental = require('../../models/rentalProducts');
const PackageCart = require('../../models/packageCart');
const { getSubscriptionStatus } = require('../../utils/subscriptionStatusHelper');
const Query = require('../../models/query');
const Repair = require('../../models/repairProducts');
const Product = require('../../models/product'); // Required for population
const Package = require('../../models/package'); // Required for population
const verifyToken = require('../../middlewares/verifyToken');

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
        } = req.query;

        page = Math.max(1, Number(page));
        limit = Math.max(1, Number(limit));

        // 1. Build User Base Match
        // Use regex for case-insensitive role match (handles 'customer', 'Customer', etc.)
        const userMatch = { role: { $regex: /^customer$/i } };

        if (search?.trim()) {
            userMatch.$or = [
                { username: { $regex: search.trim(), $options: "i" } },
                { email: { $regex: search.trim(), $options: "i" } },
                { phone: { $regex: search.trim(), $options: "i" } },
                { customerId: { $regex: search.trim(), $options: "i" } }
            ];
        }

        // If city or state filters are provided, we'll check them against the profile 
        // OR the latest order. Since we want to support both, we'll build the pipeline.

        let pipeline = [
            { $match: userMatch },

            // 2. Join with Orders for stats and filtering
            {
                $lookup: {
                    from: "orders",
                    localField: "_id",
                    foreignField: "userId",
                    as: "orders"
                }
            },

            // 3. Add Computed Fields
            {
                $addFields: {
                    orderCount: { $size: "$orders" },
                    latestOrder: { $arrayElemAt: [{ $sortArray: { input: "$orders", sortBy: { createdAt: -1 } } }, 0] },
                }
            },
            {
                $addFields: {
                    lastOrderDate: "$latestOrder.createdAt",
                    // Resolve city/state from profile or latest order
                    resolvedCity: {
                        $ifNull: [
                            "$city",
                            "$latestOrder.billingInfo.town",
                            "$latestOrder.billingInfo.city",
                            ""
                        ]
                    },
                    resolvedState: {
                        $ifNull: [
                            "$state",
                            "$latestOrder.billingInfo.state",
                            ""
                        ]
                    }
                }
            }
        ];

        // 4. Post-Join Filters (State, City, Dates)

        if (city?.trim()) {
            pipeline.push({
                $match: { resolvedCity: { $regex: city.trim(), $options: "i" } }
            });
        }

        if (state?.trim()) {
            pipeline.push({
                $match: { resolvedState: { $regex: state.trim(), $options: "i" } }
            });
        }

        if (startDate || endDate) {
            const dateMatch = {};
            if (startDate) dateMatch.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateMatch.$lte = end;
            }
            pipeline.push({
                $match: { "orders.createdAt": dateMatch }
            });
        }

        // 5. Total Count for Pagination
        const countPipeline = [...pipeline, { $count: "total" }];
        const countResult = await Auth.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        // 6. Pagination & Sorting
        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
                $project: {
                    password: 0,
                    orders: 0,
                    latestOrder: 0
                }
            }
        );

        const results = await Auth.aggregate(pipeline);

        // Map back to expected structure
        const data = results.map(item => ({
            ...item,
            city: item.resolvedCity || item.city,
            state: item.resolvedState || item.state,
        }));

        res.json({
            success: true,
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error('Error in getAllCustomers:', err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
});

/**
 * Get all details about a specific customer
 * Route: /api/user/getAllCustomers/:id
 */
/**
 * 1. BASIC PROFILE & SUMMARY
 */
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await Auth.findById(id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'Customer not found' });

        const [
            ordersCount,
            paymentsCount,
            queriesCount,
            activeSubsCount,
            activeRentalsCount
        ] = await Promise.all([
            Order.countDocuments({ userId: id }),
            Payment.countDocuments({ $or: [{ orderId: id }, { orderId: { $in: (await Order.find({ userId: id }).select('orderId')).map(o => o.orderId) } }] }),
            Query.countDocuments({ userId: id }),
            Subscription.countDocuments({ userId: id, status: 'active' }),
            Rental.countDocuments({ userId: id, rentalStatus: 'active' })
        ]);

        res.status(200).json({
            success: true,
            data: {
                profile: user,
                summary: {
                    totalOrders: ordersCount,
                    totalPayments: paymentsCount,
                    totalQueries: queriesCount,
                    activeSubscriptions: activeSubsCount,
                    activeRentals: activeRentalsCount
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

/**
 * 2. ORDERS
 */
router.get('/:id/orders', verifyToken, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.params.id })
            .sort({ createdAt: -1 })
            .populate('items.productId')
            .populate('items.packageId')
            .populate('invoiceIds')
            .populate('paymentIds');
        console.log(orders);
        res.json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * 3. PAYMENTS & SUBSCRIPTION TIMELINES
 */
router.get('/:id/payments', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [orders, subscriptions, invoices] = await Promise.all([
            Order.find({ userId: id }).select('orderId razorpayOrderId'),
            Subscription.find({ userId: id }).sort({ createdAt: -1 }),
            Invoice.find({ userId: id }).sort({ created_at: -1 })
        ]);

        const publicOrderIds = orders.map(o => o.orderId);
        const internalOrderIds = orders.map(o => o._id.toString());
        const razorpayOrderIds = orders.filter(o => o.razorpayOrderId).map(o => o.razorpayOrderId);
        const subscriptionIds = subscriptions.map(s => s.subscriptionId);

        const [payments, rentalProducts] = await Promise.all([
            Payment.find({
                $or: [
                    { orderId: { $in: [...publicOrderIds, ...internalOrderIds] } },
                    { razorpayOrderId: { $in: razorpayOrderIds } },
                    { razorpaySubscriptionId: { $in: subscriptionIds } }
                ]
            }).sort({ paymentDate: -1 }),
            Rental.find({ userId: id }).populate('productId').populate('orderId')
        ]);

        // Construct subscription timelines
        const subscriptionTimelines = rentalProducts.map(rental => {
            const timeline = [];
            const startDate = new Date(rental.rentedDate);
            const totalMonths = rental.totalPaymentsRequired || 0;
            const billingDay = rental.originalBillingDay || startDate.getDate();

            for (let i = 0; i < totalMonths; i++) {
                const expectedDate = new Date(startDate);
                expectedDate.setMonth(startDate.getMonth() + i);
                expectedDate.setDate(billingDay);

                const paymentForMonth = payments.find(p => {
                    if (p.paymentStatus !== 'Success' && p.paymentStatus !== 'Completed') return false;
                    if (p.forMonth) {
                        const pf = new Date(p.forMonth);
                        return pf.getMonth() === expectedDate.getMonth() && pf.getFullYear() === expectedDate.getFullYear();
                    }
                    // Month 1 fallback: match initial order payment
                    if (i === 0 && rental.orderId) {
                        const rzpOrderId = (rental.orderId && rental.orderId.razorpayOrderId) || "";
                        const internalOrderId = String((rental.orderId && rental.orderId._id) || rental.orderId);
                        return String(p.orderId) === internalOrderId || (p.razorpayOrderId && p.razorpayOrderId === rzpOrderId);
                    }
                    return false;
                });

                const status = getSubscriptionStatus(expectedDate, paymentForMonth);

                timeline.push({
                    month: i + 1,
                    expectedDate,
                    status,
                    paymentId: paymentForMonth?._id || null
                });
            }

            return {
                rentalId: rental.rentalId,
                productName: rental.productId?.productName,
                totalMonths,
                paymentsMade: rental.paymentsMade,
                status: rental.rentalStatus,
                timeline
            };
        });

        res.json({
            success: true,
            data: {
                payments,
                invoices,
                subscriptions,
                subscriptionTimelines
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * 4. RENTALS
 */
router.get('/:id/rentals', verifyToken, async (req, res) => {
    try {
        const [history, active] = await Promise.all([
            RentalHistory.find({ customerID: req.params.id }).sort({ createdAt: -1 }).populate('productID'),
            Rental.find({ userId: req.params.id }).sort({ createdAt: -1 }).populate('productId')
        ]);
        res.json({ success: true, data: { history, active } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * 5. SUPPORT & REPAIRS
 */
router.get('/:id/support', verifyToken, async (req, res) => {
    try {
        const user = await Auth.findById(req.params.id).select('email');
        const [queries, repairs] = await Promise.all([
            Query.find({ userId: req.params.id }).sort({ date: -1 }),
            Repair.find({ userId: user?.email }).sort({ createdAt: -1 }).populate('productId')
        ]);
        res.json({ success: true, data: { queries, repairs } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * 6. CART
 */
router.get('/:id/cart', verifyToken, async (req, res) => {
    try {
        const cart = await PackageCart.findOne({ userId: req.params.id });
        res.json({ success: true, data: cart });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

