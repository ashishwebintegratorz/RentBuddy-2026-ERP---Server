const express = require('express');
const router = express.Router();
const User = require('../../models/auth');
const { sendWhatsAppOTP } = require('../../services/aisensy.service');

// @route POST /api/auth/verify/send-otp
// @desc Send 6-digit OTP to user's WhatsApp
router.post('/send-otp', async (req, res) => {
    const { phone, userId } = req.body;

    if (!phone) {
        return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        let user;
        if (userId) {
            user = await User.findById(userId);
        } else {
            // Find by phone if userId is not provided (e.g. during registration)
            user = await User.findOne({ phone });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update user with OTP and expiry
        user.phoneVerificationOTP = otp;
        user.phoneVerificationOTPExpires = otpExpiry;
        // Optionally update phone if it's different from stored phone
        if (phone && user.phone !== phone) {
            user.phone = phone;
        }
        await user.save();

        // Send OTP via AI Sensy
        await sendWhatsAppOTP(phone, otp);

        return res.status(200).json({ 
            success: true, 
            message: "OTP sent successfully to WhatsApp" 
        });

    } catch (error) {
        console.error("Error in send-otp:", error);
        return res.status(500).json({ 
            success: false, 
            message: error.message || "Internal server error" 
        });
    }
});

// @route POST /api/auth/verify/verify-otp
// @desc Verify 6-digit OTP
router.post('/verify-otp', async (req, res) => {
    const { phone, otp, userId } = req.body;

    if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required" });
    }

    try {
        let user;
        if (userId) {
            user = await User.findById(userId);
        } else {
            user = await User.findOne({ phone });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check if OTP matches and is not expired
        if (user.phoneVerificationOTP !== otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        if (new Date() > user.phoneVerificationOTPExpires) {
            return res.status(400).json({ success: false, message: "OTP has expired" });
        }

        // Successful verification
        user.isPhoneVerified = true;
        user.phoneVerificationOTP = undefined;
        user.phoneVerificationOTPExpires = undefined;
        await user.save();

        return res.status(200).json({ 
            success: true, 
            message: "Phone number verified successfully",
            isPhoneVerified: true
        });

    } catch (error) {
        console.error("Error in verify-otp:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
});

module.exports = router;
