// login.controller.js

const loginService = require('./login.service');

exports.generateOtp = async (req, res) => {
    try {
        const { mobileNumber } = req.body;

        const response = await loginService.generateLoginOtp(mobileNumber);

        return res.status(response.success ? 200 : 400).json(response);

    } catch (error) {
        console.error('Generate Login OTP Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { mobileNumber, otp } = req.body;

        const response = await loginService.verifyLoginOtp(mobileNumber, otp);

        return res.status(response.success ? 200 : 400).json(response);

    } catch (error) {
        console.error('Verify Login OTP Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};