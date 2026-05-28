const signupRepository = require('../repositories/signup.repository');
const paymentRepository = require('../repositories/payment.repository');
const { PREMIUM_PLAN_ID } = require('./payment.service');

const registerUser = async (payload) => {
  const planId = Number(payload.planId);

  if (planId === PREMIUM_PLAN_ID) {
    const transaction = await paymentRepository.getVerifiedUnusedTransaction(
      payload.paymentTransactionId
    );

    if (!transaction || Number(transaction.PlanID) !== PREMIUM_PLAN_ID) {
      return {
        success: false,
        message: 'Premium payment verification is required',
      };
    }
  }

  const result = await signupRepository.callSignupProcedure(payload);

  if (!result || result.IsSuccess === 0) {
    return {
      success: false,
      message: result?.Message || 'Signup failed',
    };
  }

  if (planId === PREMIUM_PLAN_ID) {
    await paymentRepository.markTransactionUsed(
      payload.paymentTransactionId,
      result.UserID,
      result.MemberGroupID
    );
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
