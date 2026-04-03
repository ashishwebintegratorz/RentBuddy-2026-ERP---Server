// Document Creation Flow: Order → Barcode → Invoice → Payment → Reference Linking.

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const axios = require("axios");
const bwipjs = require("bwip-js");
const fs = require("fs");
const path = require("path");

// Import your Mongoose models here
const Order = require('../../models/orders');
const Invoice = require('../../models/invoice');
const Payment = require('../../models/payment');
const Rental = require('../../models/rentalProducts');
const Product = require('../../models/product');
const Cart = require('../../models/carts');
const Barcode = require('../../models/barcode');

const verifyToken = require('../../middlewares/verifyToken');


// Cashfree API credentials
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const Subscription_Url = 'https://api.cashfree.com/api/v2/subscriptions/nonSeamless/subscription';
const Plan_Url = "https://api.cashfree.com/api/v2/subscription-plans";


router.post('/', verifyToken, async (req, res) => {
    
});