const test = require('node:test');
const assert = require('node:assert/strict');

const emailUtil = require('../src/utils/email.util');
const smsUtil = require('../src/utils/sms.util');
const otpRepository = require('../src/repositories/otp.repository');
const signupRepository = require('../src/repositories/signup.repository');
const otpService = require('../src/services/otp.service');

test('signup OTP rejects an already registered mobile before sending SMS', async () => {
  const originalFindExisting = signupRepository.findExistingUserByMobileOrEmail;
  const originalGenerateOtp = otpRepository.generateOtp;
  const originalSendSms = smsUtil.sendOtpSms;

  signupRepository.findExistingUserByMobileOrEmail = async () => ({
    MobileNumber: '9940248280',
    EmailID: 'other@example.com',
  });
  otpRepository.generateOtp = async () => {
    throw new Error('OTP should not be generated');
  };
  smsUtil.sendOtpSms = async () => {
    throw new Error('SMS should not be sent');
  };

  try {
    await assert.rejects(
      () =>
        otpService.generateOtp({
          contactType: 'MOBILE',
          contactValue: '+919940248280',
        }),
      /Mobile number is already registered/
    );
  } finally {
    signupRepository.findExistingUserByMobileOrEmail = originalFindExisting;
    otpRepository.generateOtp = originalGenerateOtp;
    smsUtil.sendOtpSms = originalSendSms;
  }
});

test('signup OTP rejects an already registered email before sending email', async () => {
  const originalFindExisting = signupRepository.findExistingUserByMobileOrEmail;
  const originalGenerateOtp = otpRepository.generateOtp;
  const originalSendEmail = emailUtil.sendOtpEmail;

  signupRepository.findExistingUserByMobileOrEmail = async () => ({
    MobileNumber: '9999999999',
    EmailID: 'I.SAJIDBAIG@gmail.com',
  });
  otpRepository.generateOtp = async () => {
    throw new Error('OTP should not be generated');
  };
  emailUtil.sendOtpEmail = async () => {
    throw new Error('Email should not be sent');
  };

  try {
    await assert.rejects(
      () =>
        otpService.generateOtp({
          contactType: 'EMAIL',
          contactValue: 'i.sajidbaig@gmail.com',
        }),
      /Email is already registered/
    );
  } finally {
    signupRepository.findExistingUserByMobileOrEmail = originalFindExisting;
    otpRepository.generateOtp = originalGenerateOtp;
    emailUtil.sendOtpEmail = originalSendEmail;
  }
});
