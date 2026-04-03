require('dotenv').config();
const sendEmail = require('../services/email.service');
const { getTemplate } = require('../utils/emailTemplates');

async function run() {
  try {
    const email = 'ayush2003hero@gmail.com';
    const name = 'Ayush'; // Or Mahak, based on the template
    const html = getTemplate('TEST_CLARIFICATION', { name });
    const subject = "Clarification Regarding Recurring Payment Email";
    
    console.log(`Sending test email to ${email}...`);
    await sendEmail(email, subject, "Please view this email in an HTML compatible client.", html);
    console.log('✅ Test email sent!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to send:', err);
    process.exit(1);
  }
}

run();
