const express = require('express');
const router = express.Router();

const Repair = require('../../models/repairProducts');
const Rental = require('../../models/rentalProducts'); // Assuming you have a Rental model
const verifyToken = require('../../middlewares/verifyToken');

router.post('/:id', verifyToken, async (req, res) => {
    try {
        const { status } = req.body;
        const repairId = req.params.id;
        const { postedBy } = req.body;

        let repair;
        if (postedBy !== "Customer") {
            // Admin update logic
            if (status === "Cancelled") {
                // Delete the repair record if the status is "Cancelled"
                await Repair.findByIdAndDelete(repairId);
                res.status(200).json({ success: true, message: "Repair record deleted because status is 'Cancelled'" });
            } else {
                // Update the repair record with the new status
                repair = await Repair.findByIdAndUpdate(repairId, { $set: { status: status } }, { new: true });
                res.status(200).json({ success: true, message: "Status updated", repair });
            }
        } else {
            // Customer update logic
            const { actionTaken, comments, estimatedCost, partsRequired, priority, status, completionDate } = req.body;
            if (status === "Cancelled") {
                // Delete the repair record if the status is "Cancelled"
                await Repair.findByIdAndDelete(repairId);
                res.status(200).json({ success: true, message: "Repair record deleted because status is 'Cancelled'" });
            } else {
                // Update the repair record with the new status
                repair = await Repair.findByIdAndUpdate(repairId, { $set: { actionTaken, comments, estimatedCost, partsRequired, priority, status, completionDate } }, { new: true });
                res.status(200).json({ success: true, message: "Status updated", repair });
            }
        }

        // After updating repair status, update rental status
        if (repair) {
            await Rental.findOneAndUpdate({ userId: repair.userId }, { $set: { repairStatus: status } });
            // Optionally update other fields in Rental based on repair status update
        }

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update repair status', error: error.message });
    }
});

module.exports = router;
