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
const authRepository = require('../repositories/auth.repository');
const db = require('../config/db');
const logger = require('../utils/logger.util');

/* ===============================
   LOGIN OTP GENERATE
================================= */

const generateLoginOtp = async (mobileNumber) => {

  const [rows] = await db.query(
    'CALL sp_generate_login_otp(?)',
    [mobileNumber]
  );

  const result = rows[0][0];

  return {
    success: result?.IsValid === 1,
    message: result?.Message
  };
};

/* ===============================
   LOGIN OTP VERIFY
================================= */

const verifyLoginOtp = async (mobileNumber, otp) => {

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
};