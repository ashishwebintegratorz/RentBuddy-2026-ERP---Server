const express = require("express");
const router = express.Router();
const Subscription = require("../../models/subscription");
const notify = require("../../utils/subscriptionNotifier");
const verifyToken = require("../../middlewares/verifyToken");

router.post("/", verifyToken, async (req, res) => {
    const { subscriptionId } = req.body;

    const sub = await Subscription.findOne({ subscriptionId })
        .populate("userId", "email phone name");

    if (!sub) return res.status(404).json({ message: "Not found" });

    await notify(sub, sub.userId, "STRICT", sub.nextChargeAt);

    res.json({ success: true, message: "Strict reminder sent" });
});

module.exports = router;
