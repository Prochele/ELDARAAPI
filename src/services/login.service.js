// login.service.js

const loginRepository = require('./login.repository');

exports.generateLoginOtp = async (mobileNumber) => {
    if (!mobileNumber) {
        return { success: false, message: 'Mobile number is required' };
    }

    const result = await loginRepository.generateLoginOtp(mobileNumber);

    if (!result || result.IsValid === 0) {
        return { success: false, message: result?.Message || 'Failed to generate OTP' };
    }

    return {
        success: true,
        message: result.Message,
        otp: result.OTP // remove in production
    };
};

exports.verifyLoginOtp = async (mobileNumber, otp) => {
    if (!mobileNumber || !otp) {
        return { success: false, message: 'Mobile number and OTP required' };
    }

    const result = await loginRepository.verifyLoginOtp(mobileNumber, otp);

    if (!result || result.IsValid === 0) {
        return { success: false, message: result?.Message || 'Invalid OTP' };
    }

    return {
        success: true,
        message: result.Message
    };
};