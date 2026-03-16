const otpService = require('../services/otp.service');
const { successResponse } = require('../utils/response.util');

exports.generateOtp = async (req, res, next) => {
  try {
    const result = await otpService.generateOtp(req.body);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    console.log("OTP API HIT:", req.body);
    const result = await otpService.verifyOtp(req.body);
    console.log("VERIFY OTP RESULT:", result);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};