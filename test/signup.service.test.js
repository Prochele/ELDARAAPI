const test = require('node:test');
const assert = require('node:assert/strict');

const planRepository = require('../src/repositories/plan.repository');
const paymentRepository = require('../src/repositories/payment.repository');
const signupRepository = require('../src/repositories/signup.repository');
const signupService = require('../src/services/signup.service');

test('paid plans require a verified transaction for the selected plan', async () => {
  const originalGetPlan = planRepository.getActivePlanById;
  const originalGetTransaction = paymentRepository.getVerifiedUnusedTransaction;

  planRepository.getActivePlanById = async () => ({
    PlanID: 3,
    PlanName: 'Premium',
    MonthlyPrice: '799.00',
  });
  paymentRepository.getVerifiedUnusedTransaction = async () => null;

  try {
    const result = await signupService.registerUser({ planId: 3 });

    assert.equal(result.success, false);
    assert.match(result.message, /payment verification is required/);
  } finally {
    planRepository.getActivePlanById = originalGetPlan;
    paymentRepository.getVerifiedUnusedTransaction = originalGetTransaction;
  }
});

test('zero-price plans can register without a payment transaction', async () => {
  const originalGetPlan = planRepository.getActivePlanById;
  const originalSignup = signupRepository.callSignupProcedure;

  planRepository.getActivePlanById = async () => ({
    PlanID: 1,
    PlanName: 'Basic',
    MonthlyPrice: '0.00',
  });
  signupRepository.callSignupProcedure = async () => ({
    IsSuccess: 1,
    UserID: 10,
    MemberGroupID: 20,
  });

  try {
    const result = await signupService.registerUser({ planId: 1 });

    assert.equal(result.success, true);
    assert.equal(result.data.userId, 10);
  } finally {
    planRepository.getActivePlanById = originalGetPlan;
    signupRepository.callSignupProcedure = originalSignup;
  }
});
