const express = require('express');
const router = express.Router();
const loginRoute = require('./login');
const signupRoute = require('./signup');
const logoutRoute = require('./logout');
const verifyRoute = require('./verify');

router.use('/logout', logoutRoute);

router.use('/login', loginRoute);
router.use('/signup', signupRoute);
router.use('/verify', verifyRoute);

module.exports = router;