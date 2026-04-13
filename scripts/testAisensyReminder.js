require('dotenv').config();
const { sendWhatsAppCampaign } = require("../services/aisensy.service");

async function test() {
    const phone = process.argv[2];
    if (!phone) {
        console.log("Usage: node scripts/testAisensyReminder.js <phone_number>");
        console.log("Example: node scripts/testAisensyReminder.js 919876543210");
        process.exit(1);
    }

    const campaignName = process.env.AISENSY_REMINDER_CAMPAIGN_NAME;
    
    // Params: {{1}}=Name, {{2}}=Amount, {{3}}=DueDate, {{4}}=Link
    const params = ["Test Customer", "499", "25-04-2026", "https://rentbuddy.in/pay/test"];
    
    console.log("--- AI Sensy Test ---");
    console.log(`Target Phone: ${phone}`);
    console.log(`Campaign Name: ${campaignName}`);
    console.log(`Params: ${JSON.stringify(params)}`);
    console.log("---------------------");

    try {
        const result = await sendWhatsAppCampaign(phone, campaignName, params, "Test Customer");
        console.log("API Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Test Failed:", error.message);
    }
}

test();
