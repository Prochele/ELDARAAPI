const accountRepository = require('../repositories/account.repository');
const paymentRepository = require('../repositories/payment.repository');
const planRepository = require('../repositories/plan.repository');

const getProfile = async (userId) => {
  return accountRepository.getProfile(userId);
};

const updateEmail = async (userId, emailId) => {
  return accountRepository.updateEmail(userId, emailId);
};

const updatePhone = async (userId, mobileNumber) => {
  return accountRepository.updatePhone(userId, mobileNumber);
};

const updatePlan = async (userId, planId, paymentTransactionId) => {
  const selectedPlanId = Number(planId);

  if (!Number.isInteger(selectedPlanId) || selectedPlanId <= 0) {
    return {
      IsSuccess: 0,
      Message: 'A valid plan is required',
    };
  }

  const plan = await planRepository.getActivePlanById(selectedPlanId);

  if (!plan) {
    return {
      IsSuccess: 0,
      Message: 'The selected plan is unavailable',
    };
  }

  const requiresPayment = Number(plan.MonthlyPrice) > 0;

  if (requiresPayment) {
    const transaction = await paymentRepository.getVerifiedUnusedTransaction(
      paymentTransactionId
    );

    if (!transaction || Number(transaction.PlanID) !== selectedPlanId) {
      return {
        IsSuccess: 0,
        Message: 'A verified payment is required for this plan',
      };
    }

    const result = await accountRepository.updatePlan(
      userId,
      selectedPlanId,
      transaction.PaymentTransactionID
    );

    if (result?.IsSuccess === 1) {
      await paymentRepository.markTransactionUsed(
        transaction.PaymentTransactionID,
        userId,
        result.MemberGroupID
      );
    }

    return result;
  }

  return accountRepository.updatePlan(userId, selectedPlanId, null);
};

const removeAccount = async (userId) => {
  return accountRepository.removeAccount(userId);
};

module.exports = {
  getProfile,
  updateEmail,
  updatePhone,
  updatePlan,
  removeAccount,
};
