// controllers/statsController.js
const Order = require('../../models/orders'); // adjust path if needed

/**
 * GET /api/stats/orders-by-state
 * Optional query params:
 *   ?state=Gujarat    -> returns only that state grouped by town (city)
 *   ?groupBy=state|town (default: state)
 */
exports.getOrdersStats = async (req, res) => {
  try {
    const groupBy = (req.query.groupBy || 'state').toLowerCase(); // 'state' or 'town'
    const stateFilter = req.query.state; // optional - when provided, return towns of that state

    if (!['state', 'town'].includes(groupBy)) {
      return res.status(400).json({ error: 'groupBy must be "state" or "town"' });
    }

    // field to group on
    const groupField = groupBy === 'state' ? '$billingInfo.state' : '$billingInfo.town';

    // If grouping by town but state filter is provided, add $match stage
    const matchStage = {
      $match: {
        [`billingInfo.${stateFilter && groupBy === 'town' ? 'state' : 'state'}`]: stateFilter ? stateFilter : { $exists: true, $ne: null }
      }
    };

    // Build aggregation pipeline:
    // 1) Filter orders that have billingInfo.state (and optionally the provided state)
    // 2) unwind items to sum quantities
    // 3) group by billingInfo.state (or town) — collect unique orderIds for orderCount, sum item quantity for totalProducts, sum totalAmount (note: totalAmount duplicates for unwind so we will sum per-order separately)
    //
    // To prevent totalAmount being multiplied by unwind, we'll compute per-order totals in a $group first then $group again.

    const pipeline = [];

    // Filter stage: require billingInfo.state (or town depending)
    const baseMatch = { 'billingInfo.state': { $exists: true, $ne: null } };
    if (stateFilter && groupBy === 'town') {
      baseMatch['billingInfo.state'] = stateFilter;
    }
    pipeline.push({ $match: baseMatch });

    // Stage A: For each order compute totalProductsInOrder = sum(items.quantity)
    pipeline.push({
      $addFields: {
        itemsQtySum: { $sum: { $map: { input: { $ifNull: ['$items', []] }, as: 'it', in: { $ifNull: ['$$it.quantity', 0] } } } }
      }
    });

    // Stage B: Group by desired field
    pipeline.push({
      $group: {
        _id: groupField,
        orderIds: { $addToSet: '$_id' },              // unique orders
        totalProducts: { $sum: '$itemsQtySum' },     // sum of per-order product counts
        totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        ordersCount: { $sum: 1 }
      }
    });

    // Project fields and sort by ordersCount desc
    pipeline.push({
      $project: {
        _id: 0,
        name: '$_id',
        ordersCount: '$ordersCount',
        totalProducts: 1,
        totalAmount: 1
      }
    });

    pipeline.push({ $sort: { ordersCount: -1 } });

    const results = await Order.aggregate(pipeline).allowDiskUse(true);

    // Sanitize null/undefined names
    const sanitized = results.map(r => ({
      name: r.name || 'Unknown',
      ordersCount: r.ordersCount || 0,
      totalProducts: r.totalProducts || 0,
      totalAmount: r.totalAmount || 0
    }));

    return res.json({ success: true, data: sanitized });
  } catch (err) {
    console.error('getOrdersStats error', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};
