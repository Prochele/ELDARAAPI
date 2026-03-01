const signupRepository = require('../repositories/signup.repository');

const registerUser = async (payload) => {
  const result = await signupRepository.callSignupProcedure(payload);

  if (!result || result.IsSuccess === 0) {
    return {
      success: false,
      message: result?.Message || 'Signup failed',
    };
  }

  return {
    success: true,
    message: 'User registered successfully',
    data: {
      userId: result.UserID,
      memberGroupId: result.MemberGroupID,
    },
  };
};

module.exports = {
  registerUser,
};