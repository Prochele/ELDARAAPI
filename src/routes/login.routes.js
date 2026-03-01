// login.routes.js

const express = require('express');
const router = express.Router();
const loginController = require('./login.controller');

router.post('/generate-otp', loginController.generateOtp);
router.post('/verify-otp', loginController.verifyOtp);

module.exports = router;