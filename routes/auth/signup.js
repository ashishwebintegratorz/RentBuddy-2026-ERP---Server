const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../../models/auth');

router.post('/', async (req, res) => {
    const { username, email, password, phone, role } = req.body;
    // console.log(username, email, password, phone, role);
    try {
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);
        const existingUser = await User.findOne({ email: email });
        // console.log(existingUser);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const userData = { 
            username, 
            email, 
            password: hashPassword, 
            phone,
            role: role
        };

        await User.create(userData).then((response) => {
            return res.status(201).json({ 
                success: true, 
                message: 'User created successfully',
                customerId: response.customerId, // Return the generated customerId
                userId: response._id
            });
        }).catch((error) => {
            console.error(error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;