// const authRepository = require('../repositories/auth.repository');
// const logger = require('../utils/logger.util');

// const authenticateUserService = async (loginData) => {
//   logger.info('Authentication attempt', {
//     identifier: loginData.identifier,
//     //roleId: loginData.roleId,
//   });

//   const dbResult = await authRepository.authenticateUserRepo(loginData);

//   logger.info('Authentication result', {
//     isValid: dbResult.isValid,
//     message: dbResult.userId,
//   });

//   return {
//     success: dbResult.isValid === 1,
//     message: dbResult.message,
//     data: dbResult.isValid === 1
//       ? {
//           userId: dbResult.userId,
//           role: dbResult.role,
//           userName: dbResult.userName,
//           mobileNumber: dbResult.mobileNumber,
//           emailId: dbResult.emailId,
//           sessionToken: dbResult.sessionToken,
//         }
//       : null,
//   };
// };

// module.exports = {
//   authenticateUserService,
// };
// const authRepository = require('../repositories/auth.repository');
// const db = require('../config/db');
// const logger = require('../utils/logger.util');

// /* ===============================
//    LOGIN OTP GENERATE
// ================================= */

// const generateLoginOtp = async (mobileNumber) => {

//   const [rows] = await db.query(
//     'CALL sp_generate_login_otp(?)',
//     [mobileNumber]
//   );

//   const result = rows[0][0];

//   return {
//     success: result?.IsValid === 1,
//     message: result?.Message
//   };
// };

// /* ===============================
//    LOGIN OTP VERIFY
// ================================= */

// const verifyLoginOtp = async (mobileNumber, otp) => {

//   const [rows] = await db.query(
//     'CALL sp_verify_login_otp(?, ?)',
//     [mobileNumber, otp]
//   );

//   const result = rows[0][0];

//   return {
//     success: result?.IsValid === 1,
//     message: result?.Message
//   };
// };

// /* ===============================
//    FINAL LOGIN (After OTP Verify)
// ================================= */

// const authenticateUserService = async (loginData) => {

//   logger.info('Authentication attempt', {
//     identifier: loginData.identifier,
//   });

//   const dbResult = await authRepository.authenticateUserRepo(loginData);

//   logger.info('Authentication result', {
//     isValid: dbResult.isValid,
//     message: dbResult.message,
//   });

//   return {
//     success: dbResult.isValid === 1,
//     message: dbResult.message,
//     data: dbResult.isValid === 1
//       ? {
//           userId: dbResult.userId,
//           role: dbResult.role,
//           userName: dbResult.userName,
//           mobileNumber: dbResult.mobileNumber,
//           emailId: dbResult.emailId,
//           sessionToken: dbResult.sessionToken,
//         }
//       : null,
//   };
// };

// module.exports = {
//   generateLoginOtp,
//   verifyLoginOtp,
//   authenticateUserService,
// };

const authRepository = require('../repositories/auth.repository');
const db = require('../config/db');
const logger = require('../utils/logger.util');
const emailUtil = require('../utils/email.util');
const smsUtil = require('../utils/sms.util');

const normalizeIdentifier = (value) => String(value || '').trim().toLowerCase();

const getReviewerIdentifiers = () =>
  String(process.env.PLAY_REVIEWER_LOGIN_IDENTIFIERS || process.env.PLAY_REVIEWER_LOGIN_IDENTIFIER || '')
    .split(',')
    .map(normalizeIdentifier)
    .filter(Boolean);

const isReviewerLogin = (identifier) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  return normalizedIdentifier && getReviewerIdentifiers().includes(normalizedIdentifier);
};

const getReviewerOtp = () => String(process.env.PLAY_REVIEWER_LOGIN_OTP || '').trim();

const setReviewerOtp = async (identifier) => {
  const reviewerOtp = getReviewerOtp();

  if (!isReviewerLogin(identifier) || !reviewerOtp) {
    return false;
  }

  const [userRows] = await db.query(
    `
      SELECT UserID
      FROM UserMaster
      WHERE (LOWER(MobileNumber) = ? OR LOWER(EmailID) = ?)
        AND StatusID = 1
      LIMIT 1
    `,
    [normalizeIdentifier(identifier), normalizeIdentifier(identifier)]
  );

  const userId = userRows?.[0]?.UserID;

  if (!userId) {
    return false;
  }

  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [updateResult] = await db.query(
    `
      UPDATE UserAuthentication
      SET SecuredCode = ?,
          SecuredCodeGeneratedOn = NOW(),
          SecuredCodeExpiredOn = ?,
          AttemptCount = 0,
          IsSuccess = 0,
          UpdatedOn = NOW()
      WHERE UserID = ?
        AND AuthEventID = 1
    `,
    [reviewerOtp, expiry, userId]
  );

  if (!updateResult?.affectedRows) {
    await db.query(
      `
        INSERT INTO UserAuthentication (
          UserID,
          AuthEventID,
          SecuredCode,
          SecuredCodeGeneratedOn,
          SecuredCodeExpiredOn,
          AttemptCount,
          IsSuccess
        )
        VALUES (?, 1, ?, NOW(), ?, 0, 0)
      `,
      [userId, reviewerOtp, expiry]
    );
  }

  return true;
};
/* ===============================
   LOGIN OTP GENERATE
================================= */

const generateLoginOtp = async (mobileNumber) => {

  const reviewerOtpSet = await setReviewerOtp(mobileNumber);

  if (reviewerOtpSet) {
    logger.info('Play reviewer login OTP prepared', {
      identifier: mobileNumber,
    });

    return {
      success: true,
      message: 'Reviewer OTP ready'
    };
  }

  const [rows] = await db.query(
    'CALL sp_generate_login_otp(?)',
    [mobileNumber]
  );

  const result = rows[0][0];

  if (!result || result.IsValid !== 1) {
    return {
      success: false,
      message: result?.Message || 'Failed to generate OTP'
    };
  }

  const otp = result.OTP;
  const expiry = result.OTPExpiry;
  const email = result.EmailID;
  const mobnumber = result.MobileNumber;

  logger.info('OTP generated', {
    mobnumber,
    email
  });

  try {

    console.log("Sending OTP email to:", email);

    await emailUtil.sendOtpEmail(email, otp, expiry);
    await smsUtil.sendOtpSms(mobnumber, otp);
  } catch (error) {

    logger.error('OTP email sending failed', {
      error: error.message
    });

  }

  return {
    success: true,
    message: result.Message
  };
};

/* ===============================
   LOGIN OTP VERIFY
================================= */

const verifyLoginOtp = async (mobileNumber, otp) => {

  await setReviewerOtp(mobileNumber);

  const [rows] = await db.query(
    'CALL sp_verify_login_otp(?, ?)',
    [mobileNumber, otp]
  );

  const result = rows[0][0];

  return {
    success: result?.IsValid === 1,
    message: result?.Message
  };
};

/* ===============================
   FINAL LOGIN (After OTP Verify)
================================= */

const authenticateUserService = async (loginData) => {

  logger.info('Authentication attempt', {
    identifier: loginData.identifier,
  });

  await setReviewerOtp(loginData.identifier);

  const dbResult = await authRepository.authenticateUserRepo(loginData);

  logger.info('Authentication result', {
    isValid: dbResult.isValid,
    message: dbResult.message,
  });

  return {
    success: dbResult.isValid === 1,
    message: dbResult.message,
    data: dbResult.isValid === 1
      ? {
        userId: dbResult.userId,
        role: dbResult.role,
        userName: dbResult.userName,
        mobileNumber: dbResult.mobileNumber,
        emailId: dbResult.emailId,
        sessionToken: dbResult.sessionToken,
      }
      : null,
  };
};

module.exports = {
  generateLoginOtp,
  verifyLoginOtp,
  authenticateUserService,
  isReviewerLogin,
  setReviewerOtp,
};
