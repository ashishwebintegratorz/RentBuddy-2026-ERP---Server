const express = require('express');
const router = express.Router();
const addDiscount = require('./addDiscount')
const getDiscount = require('./getDiscount')

router.use('/addDiscount', addDiscount);
router.use('/getDiscounts', getDiscount)

module.exports = router;