const express = require('express');
const router = express.Router();
const User = require('../../models/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

router.post('/', async (req, res) => {
    try {
        const { email, password, role, type } = req.body;
        // console.log(email, password, role);

        // const user = await User.findOne({ email });
        // if (!user) {
        //     return res.status(400).json({ success: false, message: 'User Not Found' });
        // }

        let user = await User.findOne({ email });

        if (!user && type === "Google") {
            user = new User({
                email,
                username: email.split("@")[0],
                role,
                password: "", // No password for Google
            });
            await user.save();
        }

        if (!user) {
            return res.status(400).json({ success: false, message: 'User Not Found' });
        }


        // Check if the provided role matches the user's role
        if (role && user.role !== role) {
            return res.status(400).json({ success: false, message: 'Invalid role for this user' });
        }

        // if (type !== "Google" && password !== '') {
        //     const isMatch = await bcrypt.compare(password, user.password);
        //     if (!isMatch) {
        //         return res.status(400).json({ success: false, message: 'Invalid password' });
        //     }
        // }

        if (type !== "Google") {
            if (!password || password.trim() === "") {
              return res.status(400).json({ success: false, message: 'Password is required' });
            }
          
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
              return res.status(400).json({ success: false, message: 'Invalid password' });
            }
        }
          

        const data = {
            username: user.username,
            email: user.email,
            userId: user._id,
            role: user.role, // Include role in the token
            isPhoneVerified: user.isPhoneVerified,
        };
        // process.env.SECRET_KEY
        const token = jwt.sign(data, process.env.SECRET_KEY, { expiresIn: '12h' });

        return res.status(200).json({
            success: true,
            message: 'User Found',
            data: token,
            role: user.role,
            user: user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;