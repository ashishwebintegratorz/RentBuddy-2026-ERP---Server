const express = require('express');
const router = express.Router();
const AddReviewRoute = require('./addReview');
const GetReviewRoute = require('./getReview');


router.use("/addReviews", AddReviewRoute);
router.use("/getReviews", GetReviewRoute);

module.exports = router;