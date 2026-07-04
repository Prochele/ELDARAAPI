const test = require('node:test');
const assert = require('node:assert/strict');

process.env.RAZORPAY_KEY_ID = 'test_key';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';
process.env.RAZORPAY_CURRENCY = 'INR';

const planRepository = require('../src/repositories/plan.repository');
const paymentRepository = require('../src/repositories/payment.repository');
const paymentService = require('../src/services/payment.service');

test('createRazorpayOrder derives its amount from PlanMaster data', async () => {
  const originalGetPlan = planRepository.getActivePlanById;
  const originalCreateTransaction = paymentRepository.createTransaction;
  const originalFetch = global.fetch;
  let razorpayPayload;

  planRepository.getActivePlanById = async () => ({
    PlanID: 3,
    PlanCode: 'PREMIUM',
    PlanName: 'Premium',
    MonthlyPrice: '799.00',
  });
  paymentRepository.createTransaction = async () => 42;
  global.fetch = async (url, options) => {
    razorpayPayload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ id: 'order_test' }),
    };
  };

  try {
    const order = await paymentService.createRazorpayOrder({ planId: 3 });

    assert.equal(razorpayPayload.amount, 79900);
    assert.equal(razorpayPayload.notes.planId, '3');
    assert.equal(order.amount, 79900);
    assert.equal(order.paymentTransactionId, 42);
  } finally {
    planRepository.getActivePlanById = originalGetPlan;
    paymentRepository.createTransaction = originalCreateTransaction;
    global.fetch = originalFetch;
  }
});
