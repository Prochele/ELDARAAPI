const signupRepository = require('../repositories/signup.repository');
const paymentRepository = require('../repositories/payment.repository');
const planRepository = require('../repositories/plan.repository');

const registerUser = async (payload) => {
  const mobileNumber = String(payload.mobileNumber || '').trim();
  const emailId = String(payload.emailId || '').trim();
  const planId = Number(payload.planId);
  const plan = await planRepository.getActivePlanById(planId);

  if (!plan) {
    return {
      success: false,
      message: 'The selected plan is unavailable',
    };
  }

  if (!mobileNumber) {
    return {
      success: false,
      message: 'Mobile number is required',
    };
  }

  if (!emailId) {
    return {
      success: false,
      message: 'Email is required',
    };
  }

  const existingUser = await signupRepository.findExistingUserByMobileOrEmail(
    mobileNumber,
    emailId
  );

  if (existingUser?.MobileNumber === mobileNumber) {
    return {
      success: false,
      message: 'Mobile number is already registered',
    };
  }

  if (String(existingUser?.EmailID || '').toLowerCase() === emailId.toLowerCase()) {
    return {
      success: false,
      message: 'Email is already registered',
    };
  }

  const requiresPayment = Number(plan.MonthlyPrice) > 0;

  if (requiresPayment) {
    const transaction = await paymentRepository.getVerifiedUnusedTransaction(
      payload.paymentTransactionId
    );

    if (!transaction || Number(transaction.PlanID) !== planId) {
      return {
        success: false,
        message: `${plan.PlanName} plan payment verification is required`,
      };
    }
  }

  const result = await signupRepository.callSignupProcedure({
    ...payload,
    mobileNumber,
    emailId,
  });

  if (!result || result.IsSuccess === 0) {
    return {
      success: false,
      message: result?.Message || 'Signup failed',
    };
  }

  if (requiresPayment) {
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
