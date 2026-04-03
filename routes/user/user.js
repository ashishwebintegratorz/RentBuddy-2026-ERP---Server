const express = require('express');
const router = express.Router();
const updateProfile = require('./updateProfile');
const subscription = require('./subscribe');
const getSubscription = require('./getSubscription');
const deleteSubscription = require('./deleteSubscription');
const getAllCustomers = require("./getAllCustomers");
const deleteCustomer = require('./deleteCustomer');
const addQuery = require('./addQuery');
const getQuery = require('./getQuery')
const addUserNotes = require('./addUserNote');
const getUserNotes = require("./getUserNotes");
const customerInfo = require('./customerInfo');
const { getCustomerStats } = require('./customerStatistics');
const updateQueryStatus = require('./updateQueryStatus');
const deleteQuery = require('./deleteQuery');

router.use('/deleteQuery', deleteQuery);

router.use('/updateQueryStatus', updateQueryStatus);

router.get('/customerStats', getCustomerStats);

router.use('/updateProfile', updateProfile);
router.use('/addSubscription', subscription);
router.use('/getSubscription', getSubscription)
router.use('/deleteSubscription', deleteSubscription)
router.use('/getAllCustomers', getAllCustomers)
router.use('/deleteCustomer', deleteCustomer)
router.use('/addQuery', addQuery);
router.use('/getQuery', getQuery)
router.use('/addUserNotes', addUserNotes)
router.use('/getUserNotes', getUserNotes)
router.use('/customerInfo', customerInfo)

module.exports = router;