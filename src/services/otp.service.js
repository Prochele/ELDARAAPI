const crypto = require('crypto');
const otpRepository = require('../repositories/otp.repository');

exports.generateOtp = async ({ contactType, contactValue }) => {

  if (!contactType || !contactValue) {
    throw new Error('ContactType and ContactValue are required');
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  await otpRepository.generateOtp(contactType, contactValue, otp);

  // TODO: Send SMS / Email here

  return { message: 'OTP sent successfully' };
};

exports.verifyOtp = async ({ contactType, contactValue, otp }) => {

  if (!contactType || !contactValue || !otp) {
    throw new Error('Invalid verification request');
  }

  const result = await otpRepository.verifyOtp(contactType, contactValue, otp);

  if (!result) {
    throw new Error('Verification failed');
  }

  return result; // returns { IsValid, Message }
};