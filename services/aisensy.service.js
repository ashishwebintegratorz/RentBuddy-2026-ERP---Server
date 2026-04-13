const axios = require('axios');

const AISENSY_API_KEY = process.env.AISENSY_API_KEY;
const AISENSY_CAMPAIGN_NAME = process.env.AISENSY_CAMPAIGN_NAME;

/**
 * Sends a WhatsApp message using AI Sensy API
 * @param {string} phone - Recipient phone number (with country code, e.g., 919876543210)
 * @param {string} otp - The 6-digit OTP code
 */
const sendWhatsAppOTP = async (phone, otp) => {
    if (!AISENSY_API_KEY || !AISENSY_CAMPAIGN_NAME) {
        console.error("AI Sensy API Key or Campaign Name is missing in .env");
        throw new Error("AI Sensy configuration missing");
    }

    // Ensure phone has country code (default to 91 if 10 digits)
    let formattedPhone = phone;
    if (phone.length === 10) {
        formattedPhone = `91${phone}`;
    } else if (phone.startsWith('+')) {
        formattedPhone = phone.substring(1);
    }

    const data = {
        apiKey: AISENSY_API_KEY,
        campaignName: AISENSY_CAMPAIGN_NAME,
        destination: formattedPhone,
        userName: "RentBuddy User",
        templateParams: [otp],
        source: "API",
        media: {
            url: "",
            filename: ""
        },
        buttons: [
            {
                type: "button",
                sub_type: "url",
                index: 0,
                parameters: [
                    {
                        type: "text",
                        text: otp
                    }
                ]
            }
        ]
    };

    try {
        const response = await axios.post('https://backend.aisensy.com/campaign/t1/api/v2', data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            console.log(`OTP sent successfully to ${formattedPhone}`);
            return response.data;
        } else {
            console.error(`AI Sensy error: ${response.data.message}`);
            throw new Error(response.data.message || "Failed to send OTP");
        }
    } catch (error) {
        console.error("WhatsApp OTP send failed:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Sends a generic WhatsApp campaign using AI Sensy API
 * @param {string} phone - Recipient phone number
 * @param {string} campaignName - The name of the campaign/template
 * @param {Array<string>} templateParams - Parameters for the template
 * @param {string} userName - Optional user name for tracking
 */
const sendWhatsAppCampaign = async (phone, campaignName, templateParams, userName = "RentBuddy User") => {
    if (!AISENSY_API_KEY) {
        console.error("AI Sensy API Key is missing in .env");
        throw new Error("AI Sensy configuration missing");
    }

    if (!campaignName) {
        console.error("AI Sensy Campaign Name is missing for this call");
        return;
    }

    // Ensure phone has country code (default to 91 if 10 digits)
    let formattedPhone = phone;
    if (phone && phone.length === 10) {
        formattedPhone = `91${phone}`;
    } else if (phone && phone.startsWith('+')) {
        formattedPhone = phone.substring(1);
    } else if (!phone) {
        console.error("AI Sensy: No phone number provided");
        return;
    }

    const data = {
        apiKey: AISENSY_API_KEY,
        campaignName: campaignName,
        destination: formattedPhone,
        userName: userName || "RentBuddy User",
        templateParams: templateParams,
        source: "API",
        media: {
            url: "",
            filename: ""
        }
    };

    try {
        const response = await axios.post('https://backend.aisensy.com/campaign/t1/api/v2', data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            console.log(`Campaign ${campaignName} sent successfully to ${formattedPhone}`);
            return response.data;
        } else {
            console.error(`AI Sensy error: ${response.data.message}`);
            return response.data;
        }
    } catch (error) {
        console.error("WhatsApp campaign send failed:", error.response?.data || error.message);
        throw error;
    }
};

module.exports = { sendWhatsAppOTP, sendWhatsAppCampaign };
