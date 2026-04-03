require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/auth');
const Subscription = require('../models/subscription');
const Order = require('../models/orders');
const sendEmail = require('../services/email.service');
const { getTemplate } = require('../utils/emailTemplates');

const GRACE_DAYS = Number(process.env.SUBSCRIPTION_GRACE_DAYS || 5);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ MongoDB connected');

    const now = new Date();
    
    // Get all relevant subscriptions
    const subs = await Subscription.find({
      status: { $in: ['created', 'active', 'past_due'] },
    }).populate('userId', 'username email phone customerId').lean();
    
    const usersToEmail = new Map(); // Deduplicate by email address
    
    for (const sub of subs) {
      if (!sub.userId || !sub.userId.email) continue;
      
      const nextChargeAtDate = sub.nextChargeAt ? new Date(sub.nextChargeAt) : null;
      const cycleStartDate = nextChargeAtDate ? new Date(nextChargeAtDate) : null;
      if (cycleStartDate) cycleStartDate.setMonth(cycleStartDate.getMonth() - 1);

      const hasPaidThisCycle = sub.lastPaymentAt && cycleStartDate && sub.lastPaymentAt >= cycleStartDate;

      const graceUntil =
        sub.graceUntil ||
        (nextChargeAtDate
          ? new Date(
            new Date(nextChargeAtDate).setDate(
              nextChargeAtDate.getDate() + GRACE_DAYS
            )
          )
          : null);

      let cycleStatus = 'unknown';

      if (hasPaidThisCycle) {
        cycleStatus = 'paid';
      } else if (nextChargeAtDate && now < nextChargeAtDate) {
        cycleStatus = 'not_due_yet';
      } else if (
        nextChargeAtDate &&
        graceUntil &&
        now >= nextChargeAtDate &&
        now <= graceUntil
      ) {
        cycleStatus = 'in_grace';
      } else if (nextChargeAtDate && graceUntil && now > graceUntil) {
        cycleStatus = 'overdue';
      }
      
      // We want to email users who are NOT due, overdue, or in grace.
      if (cycleStatus === 'paid' || cycleStatus === 'not_due_yet') {
         usersToEmail.set(sub.userId.email, sub.userId.username);
      }
    }
    
    console.log(`Found ${usersToEmail.size} unique users to send the clarification email to.`);
    
    // Safety check 
    if (process.argv[2] !== '--execute') {
      console.log('Dry run complete. Run with "--execute" to actually send the emails.');
      console.log('Sample of users that would receive the email:');
      const sample = Array.from(usersToEmail.entries()).slice(0, 10);
      console.log(sample);
      process.exit(0);
    }
    
    let sentCount = 0;
    for (const [email, name] of usersToEmail.entries()) {
      const html = getTemplate('TEST_CLARIFICATION', { name });
      const subject = "Clarification Regarding Recurring Payment Email";
      console.log(`Sending to ${email}...`);
      await sendEmail(email, subject, "Please view this email in an HTML compatible client.", html);
      sentCount++;
      // Optional: small delay to prevent rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ Finished sending ${sentCount} emails`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error in script:', err);
    process.exit(1);
  }
}

run();
