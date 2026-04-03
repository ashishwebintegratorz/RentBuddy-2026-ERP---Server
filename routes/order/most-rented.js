const express = require('express');
const router = express.Router();
const Rental = require("../../models/rentalProducts");
const Product = require('../../models/product');
const verifyToken = require('../../middlewares/verifyToken');



router.get('/',verifyToken, async(req,res) => {
    try {
        const count = await Rental.countDocuments();
        console.log('Total rental documents:', count);
        const result = await Rental.aggregate([
            {
                $group: {
                    _id: '$productId',
                    count: {$sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            {
                $unwind: '$productInfo'
            },
            {
                $project: {
                    _id: 0,
                    productName: '$productInfo.productName',
                    count: 1
                }
            }
        ]);

        console.log(result)

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching most rented products:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;