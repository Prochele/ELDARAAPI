const planRepository = require('../repositories/plan.repository');

const listActivePlans = async () => {
  const plans = await planRepository.listActivePlans();

  return plans.map((plan) => ({
    ...plan,
    MonthlyPrice: Number(plan.MonthlyPrice),
    YearlyPrice: Number(plan.YearlyPrice),
  }));
};

module.exports = {
  listActivePlans,
};
