const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');
const authRepository = require('../src/repositories/auth.repository');
const emailUtil = require('../src/utils/email.util');
const smsUtil = require('../src/utils/sms.util');
const authService = require('../src/services/auth.service');

const withReviewerEnv = async (fn) => {
  const originalIdentifiers = process.env.PLAY_REVIEWER_LOGIN_IDENTIFIERS;
  const originalIdentifier = process.env.PLAY_REVIEWER_LOGIN_IDENTIFIER;
  const originalOtp = process.env.PLAY_REVIEWER_LOGIN_OTP;

  process.env.PLAY_REVIEWER_LOGIN_IDENTIFIERS = '9000000000,reviewer@example.com';
  delete process.env.PLAY_REVIEWER_LOGIN_IDENTIFIER;
  process.env.PLAY_REVIEWER_LOGIN_OTP = '123456';

  try {
    await fn();
  } finally {
    if (originalIdentifiers === undefined) {
      delete process.env.PLAY_REVIEWER_LOGIN_IDENTIFIERS;
    } else {
      process.env.PLAY_REVIEWER_LOGIN_IDENTIFIERS = originalIdentifiers;
    }

    if (originalIdentifier === undefined) {
      delete process.env.PLAY_REVIEWER_LOGIN_IDENTIFIER;
    } else {
      process.env.PLAY_REVIEWER_LOGIN_IDENTIFIER = originalIdentifier;
    }

    if (originalOtp === undefined) {
      delete process.env.PLAY_REVIEWER_LOGIN_OTP;
    } else {
      process.env.PLAY_REVIEWER_LOGIN_OTP = originalOtp;
    }
  }
};

test('reviewer OTP generation prepares the configured code without sending email or SMS', async () => {
  const originalQuery = db.query;
  const originalSendEmail = emailUtil.sendOtpEmail;
  const originalSendSms = smsUtil.sendOtpSms;
  const calls = [];

  db.query = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes('SELECT UserID')) {
      return [[{ UserID: 42 }]];
    }

    if (sql.includes('UPDATE UserAuthentication')) {
      return [{ affectedRows: 1 }];
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  };
  emailUtil.sendOtpEmail = async () => {
    throw new Error('Email should not be sent for reviewer login');
  };
  smsUtil.sendOtpSms = async () => {
    throw new Error('SMS should not be sent for reviewer login');
  };

  try {
    await withReviewerEnv(async () => {
      const result = await authService.generateLoginOtp('9000000000');

      assert.equal(result.success, true);
      assert.equal(result.message, 'Reviewer OTP ready');
      assert.equal(calls.length, 2);
      assert.match(calls[1].sql, /UPDATE UserAuthentication/);
      assert.equal(calls[1].params[0], '123456');
      assert.equal(calls[1].params[2], 42);
    });
  } finally {
    db.query = originalQuery;
    emailUtil.sendOtpEmail = originalSendEmail;
    smsUtil.sendOtpSms = originalSendSms;
  }
});

test('reviewer final login seeds the reusable OTP before authenticating normally', async () => {
  const originalQuery = db.query;
  const originalAuthenticate = authRepository.authenticateUserRepo;
  const calls = [];

  db.query = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes('SELECT UserID')) {
      return [[{ UserID: 77 }]];
    }

    if (sql.includes('UPDATE UserAuthentication')) {
      return [{ affectedRows: 0 }];
    }

    if (sql.includes('INSERT INTO UserAuthentication')) {
      return [{ insertId: 1 }];
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  };
  authRepository.authenticateUserRepo = async (loginData) => ({
    isValid: loginData.otp === '123456' ? 1 : 0,
    message: loginData.otp === '123456' ? 'Success' : 'Invalid OTP',
    userId: 77,
    role: 'PTASelf',
    userName: 'Play Reviewer',
    mobileNumber: '9000000000',
    emailId: 'reviewer@example.com',
    sessionToken: 'session-token',
  });

  try {
    await withReviewerEnv(async () => {
      const result = await authService.authenticateUserService({
        identifier: 'reviewer@example.com',
        otp: '123456',
        deviceUUID: 'PLAY-REVIEW',
        platform: 'ANDROID',
        appVersion: '1.0.0',
      });

      assert.equal(result.success, true);
      assert.equal(result.data.sessionToken, 'session-token');
      assert.equal(calls.length, 3);
      assert.match(calls[2].sql, /INSERT INTO UserAuthentication/);
      assert.equal(calls[2].params[0], 77);
      assert.equal(calls[2].params[1], '123456');
    });
  } finally {
    db.query = originalQuery;
    authRepository.authenticateUserRepo = originalAuthenticate;
  }
});
