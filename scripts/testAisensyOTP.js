const axios = require('axios');
require('dotenv').config();

const AISENSY_API_KEY = process.env.AISENSY_API_KEY;
const OTP_CAMPAIGN = process.env.AISENSY_CAMPAIGN_NAME; // Mobile_no_verification

async function testOTP() {
    const phone = process.argv[2] || "9876543214";
    console.log(`--- Testing OTP Campaign: ${OTP_CAMPAIGN} ---`);
    
    // Ensure phone has country code
    let formattedPhone = phone;
    if (phone.length === 10) formattedPhone = `91${phone}`;

    const data = {
        apiKey: AISENSY_API_KEY,
        campaignName: OTP_CAMPAIGN,
        destination: formattedPhone,
        userName: "Test User",
        templateParams: ["123456"], // OTP template usually has 1 param
        source: "API"
    };

    try {
        const response = await axios.post('https://backend.aisensy.com/campaign/t1/api/v2', data);
        console.log("Success Response:", response.data);
    } catch (error) {
        console.error("Error Response:", error.response?.data || error.message);
    }
}

testOTP();
