const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  name: String,
  status: { type: Boolean, default: true },
}, { collection: 'companies' }); 

module.exports = mongoose.model('Company', CompanySchema);