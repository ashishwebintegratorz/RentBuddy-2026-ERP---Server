const express = require("express");
const router = express.Router();

router.use("/create", require("./addPackage"));
router.use("/update", require("./updatePackage"));
router.use("/toggle", require("./activateAndDeactivate"));
router.use("/delete", require("./deletePackages"));
router.use("/:id", require("./getPackageById"));
router.use("/getAllPackages", require("./getAllPackages")); // ✅ ALWAYS LAST
router.use("/getActivePackages", require("./getActivePackages")); // ✅ ALWAYS LAST

module.exports = router;
