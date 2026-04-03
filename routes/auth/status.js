const express = require('express');
const router = express.Router();
const Company = require('../../models/company')

// routes/routes.js or new route file
router.get('/status', async (req, res) => {
  try {
    const company = await Company.findOne().lean();
    const suspended = !company || company.status === false;
    return res.json({ suspended });
  } catch (err) {
    return res.status(500).json({ suspended: true });
  }
});


module.exports = router;