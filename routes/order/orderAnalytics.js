const Order = require("../../models/orders");
const User = require("../../models/auth");

// 📊 ORDER ANALYTICS CONTROLLER - CLEAN + UI READY
exports.getOrderAnalytics = async (req, res) => {
  try {
    // ------------------ 1. Base Stats ------------------
    const base = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["Paid", "Active", "Success"] } } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, totalOrders: { $sum: 1 } } }
    ]);

    const totalRevenue = base[0]?.totalRevenue || 0;
    const totalOrders = base[0]?.totalOrders || 0;

    // ------------------ 2. Revenue by Month ------------------
    const revenueData = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["Paid", "Active", "Success"] } } },
      {
        $group: {
          _id: { y: { $year:"$createdAt" }, m:{ $month:"$createdAt" } },
          totalAmount:{ $sum:"$totalAmount" },
          orders:{ $sum:1 }
        }
      },
      { $sort:{ "_id.y":1, "_id.m":1 } }
    ]);

    const revenueByMonth = revenueData.map(m => ({
      label: `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m._id.m-1]} ${m._id.y}`,
      totalAmount: m.totalAmount || 0,
      orders: m.orders || 0,
      avgOrderValue: m.orders ? Number((m.totalAmount/m.orders).toFixed(2)) : 0
    }));

    const currentMonth = revenueByMonth.at(-1);

    // ------------------ 3. Top Customers ------------------
    const topCustomers = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["Paid", "Active", "Success"] } } },
      { $group:{ _id:"$userId", spent:{ $sum:"$totalAmount" }, totalOrders:{ $sum:1 } } },
      { $sort:{ spent:-1 } }, { $limit:10 },
      {
        $lookup:{
          from:"users",       // your user collection name MUST match schema
          localField:"_id",
          foreignField:"_id",
          as:"user"
        }
      },
      {
        $project:{
          name:{ $arrayElemAt:["$user.username",0] },
          email:{ $arrayElemAt:["$user.email",0] },
          spent:1,
          totalOrders:1,
          _id:0
        }
      }
    ]);

    // ------------------ 4. Product Revenue ------------------
    const productRevenue = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["Paid", "Active", "Success"] } } },
      { $unwind:"$items" },
      { $group:{ _id:"$items.productName", revenue:{ $sum:"$items.rent" }, orders:{ $sum:1 } } },
      { $sort:{ revenue:-1 }},
      { $project:{ productName:"$_id", revenue:1, orders:1, _id:0 }}
    ]);

    // ------------------ 5. Payment Type ------------------
    const paymentType = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["Paid", "Active", "Success"] } } },
      { $group:{ _id:"$paymentType", amount:{ $sum:"$totalAmount" }, count:{ $sum:1 } } },
      { $project:{ paymentType:"$_id", amount:1, count:1, _id:0 }}
    ]);

    // ------------------ 6. Payment Status ------------------
    const paymentStatus = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["Paid", "Active", "Success"] } } },
      { $group:{ _id:"$paymentStatus", amount:{ $sum:"$totalAmount" }, count:{ $sum:1 } } },
      { $project:{ status:"$_id", amount:1, count:1, _id:0 }}
    ]);

    // ------------------ 7. Revenue by State ------------------
    const revenueByState = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["Paid", "Active", "Success"] } } },
      { $group:{ _id:"$billingInfo.state", revenue:{ $sum:"$totalAmount" }, orders:{ $sum:1 } } },
      { $project:{ state:"$_id", revenue:1, orders:1, _id:0 }}
    ]);

    // ------------------ SUMMARY OBJECT (Dashboard Cards) ------------------
    const summary = {
      totalOrders,
      totalRevenue,
      monthlyRevenue: currentMonth?.totalAmount || 0,
      monthlyOrders: currentMonth?.orders || 0,
      avgOrderValue: currentMonth?.avgOrderValue || 0,
      repeatCustomerRate:
        topCustomers.length > 0
          ? Math.round((topCustomers.filter(c => c.totalOrders > 1).length / topCustomers.length) * 100)
          : 0
    };

    return res.status(200).json({
      success:true,
      data:{
        summary,
        revenueByMonth,
        topCustomers,
        productRevenue,
        revenueByState,
        paymentType,
        paymentStatus
      }
    });

  } catch (error) {
    console.log("Order Analytics Error:", error);
    return res.status(500).json({ success:false, message:"Server Error", error });
  }
};
