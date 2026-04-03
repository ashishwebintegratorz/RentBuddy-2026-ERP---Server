// routes/user/deleteQuery.js
const express = require('express');
const router = express.Router();
const Query = require('../../models/query');
const verifyToken = require('../../middlewares/verifyToken');

router.delete('/:complaintId', verifyToken, async (req, res) => {
  try {
    const { complaintId } = req.params;

    const deleted = await Query.findOneAndDelete({ complaintId });

    if (!deleted) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Complaint deleted successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
