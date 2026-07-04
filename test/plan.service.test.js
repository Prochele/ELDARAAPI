const test = require('node:test');
const assert = require('node:assert/strict');

const planRepository = require('../src/repositories/plan.repository');
const planService = require('../src/services/plan.service');

test('listActivePlans returns numeric database prices', async () => {
  const original = planRepository.listActivePlans;

  planRepository.listActivePlans = async () => [
    {
      PlanID: 3,
      PlanCode: 'PREMIUM',
      PlanName: 'Premium',
      MonthlyPrice: '799.00',
      YearlyPrice: '5999.00',
    },
  ];

  try {
    const plans = await planService.listActivePlans();

    assert.equal(plans[0].MonthlyPrice, 799);
    assert.equal(plans[0].YearlyPrice, 5999);
  } finally {
    planRepository.listActivePlans = original;
  }
});
