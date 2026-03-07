// // login.service.js

// const loginRepository = require('./login.repository');

// exports.generateLoginOtp = async (mobileNumber) => {
//     if (!mobileNumber) {
//         return { success: false, message: 'Mobile number is required' };
//     }

//     const result = await loginRepository.generateLoginOtp(mobileNumber);

//     if (!result || result.IsValid === 0) {
//         return { success: false, message: result?.Message || 'Failed to generate OTP' };
//     }

//     return {
//         success: true,
//         message: result.Message,
//         otp: result.OTP // remove in production
//     };
// };

// exports.verifyLoginOtp = async (mobileNumber, otp) => {
//     if (!mobileNumber || !otp) {
//         return { success: false, message: 'Mobile number and OTP required' };
//     }

//     const result = await loginRepository.verifyLoginOtp(mobileNumber, otp);

//     if (!result || result.IsValid === 0) {
//         return { success: false, message: result?.Message || 'Invalid OTP' };
//     }

//     return {
//         success: true,
//         message: result.Message
//     };
// };
// login.service.js

//const loginRepository = require('./login.repository');
const loginRepository = require('../repositories/login.repository');
const emailUtil = require('../utils/email.util');

exports.generateLoginOtp = async (mobileNumber) => {
console.log('Email1111111');
    if (!mobileNumber) {
        return { success: false, message: 'Mobile number is required' };
    }

    const result = await loginRepository.generateLoginOtp(mobileNumber);
    console.log("OTP SP Result:", result);

    if (!result || result.IsValid === 0) {
        return { success: false, message: result?.Message || 'Failed to generate OTP' };
    }

    const otp = result.OTP;
    const expiry = result.OTPExpiry;
    const email = result.EmailID;
    console.log('Email', email);
    try {

        await emailUtil.sendOtpEmail(email, otp, expiry);

    } catch (error) {
        console.error('OTP Email Send Error:', error);
    }

    return {
        success: true,
        message: result.Message
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