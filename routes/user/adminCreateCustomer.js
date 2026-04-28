const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../../models/auth');
const verifyToken = require('../../middlewares/verifyToken');
const sendEmail = require('../../services/email.service');

// Password generator helper
function generatePassword(length = 10) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}

router.post('/', verifyToken, async (req, res) => {
    // Only allow admins and managers
    if (!req.user.role || (!req.user.role.includes('admin') && !req.user.role.toLowerCase().includes('manager'))) {
        return res.status(403).json({ success: false, message: 'Forbidden. Admin/Manager access required.' });
    }

    const { firstName, lastName, email, phone, city, address, pincode } = req.body;
    
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    try {
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User with this email already exists' });
        }

        const username = firstName && lastName ? `${firstName} ${lastName}` : (firstName || 'Customer');
        const autoPassword = generatePassword();
        
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(autoPassword, salt);

        const userData = { 
            username, 
            email, 
            password: hashPassword, 
            phone,
            city,
            address,
            pincode,
            role: 'customer',
            isPhoneVerified: true // Assume verified since admin created it
        };

        const newUser = await User.create(userData);

        // Send email to customer with credentials
        const emailSubject = "Welcome to RentBuddy - Your Account Details";
        const emailText = `Hi ${username},\n\nYour RentBuddy account has been successfully created by our team.\n\nLogin Email: ${email}\nPassword: ${autoPassword}\n\nPlease keep this password secure or change it after logging in.\n\nThank you,\nRentBuddy Team`;
        
        await sendEmail(email, emailSubject, emailText);

        return res.status(201).json({ 
            success: true, 
            message: 'Customer created successfully',
            userId: newUser._id,
            customerId: newUser.customerId
        });

    } catch (error) {
        console.error("Admin Create Customer Error:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
