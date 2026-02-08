const authRepository = require('../repositories/auth.repository');
const logger = require('../utils/logger.util');

const authenticateUserService = async (loginData) => {
  logger.info('Authentication attempt', {
    identifier: loginData.identifier,
    roleId: loginData.roleId,
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
          userName: dbResult.userName,
          mobileNumber: dbResult.mobileNumber,
          emailId: dbResult.emailId,
          sessionToken: dbResult.sessionToken,
        }
      : null,
  };
};

module.exports = {
  authenticateUserService,
};
