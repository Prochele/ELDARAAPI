// const crypto = require('crypto');
// const otpRepository = require('../repositories/otp.repository');

// exports.generateOtp = async ({ contactType, contactValue }) => {

//   if (!contactType || !contactValue) {
//     throw new Error('ContactType and ContactValue are required');
//   }

//   const otp = crypto.randomInt(100000, 999999).toString();

//   await otpRepository.generateOtp(contactType, contactValue, otp);

//   // TODO: Send SMS / Email here

//   return { message: 'OTP sent successfully' };
// };

// exports.verifyOtp = async ({ contactType, contactValue, otp }) => {

//   if (!contactType || !contactValue || !otp) {
//     throw new Error('Invalid verification request');
//   }

//   const result = await otpRepository.verifyOtp(contactType, contactValue, otp);

//   if (!result) {
//     throw new Error('Verification failed');
//   }

//   return result; // returns { IsValid, Message }
// };

const crypto = require('crypto');
const otpRepository = require('../repositories/otp.repository');
const signupRepository = require('../repositories/signup.repository');
const emailUtil = require('../utils/email.util');
const smsUtil = require('../utils/sms.util');

const normalizeMobileNumber = value =>
  String(value || '')
    .trim()
    .replace(/^\+?91/, '');

const validateSignupContactIsAvailable = async ({
  contactType,
  contactValue,
  mobileNumber,
  emailId,
}) => {
  const normalizedContactType = String(contactType || '').toUpperCase();

  if (normalizedContactType === 'EMAIL') {
    const email = String(emailId || contactValue || '').trim();

    if (!email) {
      throw new Error('Email is required');
    }

    const existingUser =
      await signupRepository.findExistingUserByMobileOrEmail('', email);

    if (String(existingUser?.EmailID || '').toLowerCase() === email.toLowerCase()) {
      throw new Error('Email is already registered');
    }
  }

  if (normalizedContactType === 'MOBILE') {
    const mobile = normalizeMobileNumber(mobileNumber || contactValue);

    if (!mobile) {
      throw new Error('Mobile number is required');
    }

    const existingUser =
      await signupRepository.findExistingUserByMobileOrEmail(mobile, '');

    if (normalizeMobileNumber(existingUser?.MobileNumber) === mobile) {
      throw new Error('Mobile number is already registered');
    }
  }
};

exports.generateOtp = async ({
  contactType,
  contactValue,
  validateUnique = true,
  mobileNumber,
  emailId,
}) => {

  if (!contactType || !contactValue) {
    throw new Error('ContactType and ContactValue are required');
  }

  if (validateUnique) {
    await validateSignupContactIsAvailable({
      contactType,
      contactValue,
      mobileNumber,
      emailId,
    });
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  await otpRepository.generateOtp(contactType, contactValue, otp);

  if (contactType === 'EMAIL') {
    await emailUtil.sendOtpEmail(contactValue, otp);
  }

  if (contactType === 'MOBILE') {
    const mobileNumber = contactValue.startsWith('+')
      ? contactValue
      : `${contactValue}`;

    await smsUtil.sendOtpSms(mobileNumber, otp);
  }

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
