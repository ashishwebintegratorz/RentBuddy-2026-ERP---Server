const Auth = require("../../models/auth");
const mongoose = require("mongoose");

exports.getCustomerStats = async (req, res) => {
  try {
    // Fetch only role = customer (case-insensitive fix)
    const filter = { role: { $regex: /^customer$/i } };

    // Total customers
    const totalCustomers = await Auth.countDocuments(filter);

    // Subscribed customers
    const subscribedCustomers = await Auth.countDocuments({
      ...filter,
      isSubscribed: true,
    });

    // Unsubscribed customers
    const unsubscribedCustomers = totalCustomers - subscribedCustomers;

    // New customers in the current month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const newCustomersThisMonth = await Auth.countDocuments({
      ...filter,
      createdAt: { $gte: startOfMonth },
    });

    // Group customers by city
    const customersByCity = await Auth.aggregate([
      { $match: filter },
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Group customers by pincode
    const customersByPincode = await Auth.aggregate([
      { $match: filter },
      { $group: { _id: "$pincode", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Last 10 recent customers
    const latestCustomers = await Auth.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Final response
    res.status(200).json({
    
      success: true,
      stats: {
        totalCustomers,
        subscribedCustomers,
        unsubscribedCustomers,
        newCustomersThisMonth,
        customersByCity,
        customersByPincode,
        latestCustomers,
      },
    });
    
   
    
  } catch (error) {
    console.error("Error fetching customer statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer statistics",
    });
  }
};
