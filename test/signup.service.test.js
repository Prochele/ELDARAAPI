const test = require('node:test');
const assert = require('node:assert/strict');

const planRepository = require('../src/repositories/plan.repository');
const paymentRepository = require('../src/repositories/payment.repository');
const signupRepository = require('../src/repositories/signup.repository');
const signupService = require('../src/services/signup.service');

test('paid plans require a verified transaction for the selected plan', async () => {
  const originalGetPlan = planRepository.getActivePlanById;
  const originalGetTransaction = paymentRepository.getVerifiedUnusedTransaction;
  const originalFindExisting = signupRepository.findExistingUserByMobileOrEmail;

  planRepository.getActivePlanById = async () => ({
    PlanID: 3,
    PlanName: 'Premium',
    MonthlyPrice: '799.00',
  });
  signupRepository.findExistingUserByMobileOrEmail = async () => null;
  paymentRepository.getVerifiedUnusedTransaction = async () => null;

  try {
    const result = await signupService.registerUser({
      planId: 3,
      mobileNumber: '9000000000',
      emailId: 'new@example.com',
    });

    assert.equal(result.success, false);
    assert.match(result.message, /payment verification is required/);
  } finally {
    planRepository.getActivePlanById = originalGetPlan;
    paymentRepository.getVerifiedUnusedTransaction = originalGetTransaction;
    signupRepository.findExistingUserByMobileOrEmail = originalFindExisting;
  }
});

test('zero-price plans can register without a payment transaction', async () => {
  const originalGetPlan = planRepository.getActivePlanById;
  const originalSignup = signupRepository.callSignupProcedure;
  const originalFindExisting = signupRepository.findExistingUserByMobileOrEmail;

  planRepository.getActivePlanById = async () => ({
    PlanID: 1,
    PlanName: 'Basic',
    MonthlyPrice: '0.00',
  });
  signupRepository.findExistingUserByMobileOrEmail = async () => null;
  signupRepository.callSignupProcedure = async () => ({
    IsSuccess: 1,
    UserID: 10,
    MemberGroupID: 20,
  });

  try {
    const result = await signupService.registerUser({
      planId: 1,
      mobileNumber: '9000000000',
      emailId: 'new@example.com',
    });

    assert.equal(result.success, true);
    assert.equal(result.data.userId, 10);
  } finally {
    planRepository.getActivePlanById = originalGetPlan;
    signupRepository.callSignupProcedure = originalSignup;
    signupRepository.findExistingUserByMobileOrEmail = originalFindExisting;
  }
});

test('signup returns a validation error when mobile number already exists', async () => {
  const originalGetPlan = planRepository.getActivePlanById;
  const originalFindExisting = signupRepository.findExistingUserByMobileOrEmail;

  planRepository.getActivePlanById = async () => ({
    PlanID: 2,
    PlanName: 'Standard',
    MonthlyPrice: '0.00',
  });
  signupRepository.findExistingUserByMobileOrEmail = async () => ({
    MobileNumber: '9043592910',
    EmailID: 'other@example.com',
  });

  try {
    const result = await signupService.registerUser({
      planId: 2,
      mobileNumber: '9043592910',
      emailId: 'new@example.com',
    });

    assert.equal(result.success, false);
    assert.equal(result.message, 'Mobile number is already registered');
  } finally {
    planRepository.getActivePlanById = originalGetPlan;
    signupRepository.findExistingUserByMobileOrEmail = originalFindExisting;
  }
});

test('signup returns a validation error when email already exists', async () => {
  const originalGetPlan = planRepository.getActivePlanById;
  const originalFindExisting = signupRepository.findExistingUserByMobileOrEmail;

  planRepository.getActivePlanById = async () => ({
    PlanID: 2,
    PlanName: 'Standard',
    MonthlyPrice: '0.00',
  });
  signupRepository.findExistingUserByMobileOrEmail = async () => ({
    MobileNumber: '9999999999',
    EmailID: 'I.SAJIDBAIG@gmail.com',
  });

  try {
    const result = await signupService.registerUser({
      planId: 2,
      mobileNumber: '9043592910',
      emailId: 'i.sajidbaig@gmail.com',
    });

    assert.equal(result.success, false);
    assert.equal(result.message, 'Email is already registered');
  } finally {
    planRepository.getActivePlanById = originalGetPlan;
    signupRepository.findExistingUserByMobileOrEmail = originalFindExisting;
  }
});
