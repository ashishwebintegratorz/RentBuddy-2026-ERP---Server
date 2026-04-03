const path = require('path');
const Company = require('../models/company');

const companyStatusCheck = async (req, res, next) => {
  try {
    const company = await Company.findOne().lean();
    const suspended = company && company.status === false;

    if (suspended) {
      return res.sendFile(path.join(__dirname, '../public/suspended.html'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Company is active → continue normally
    return next();
  } catch (error) {
    console.error('Middleware error:', error);
    return res.status(503).send('<h1>Service Unavailable</h1><p>Please try again later.</p>');
  }
};

module.exports = companyStatusCheck;
