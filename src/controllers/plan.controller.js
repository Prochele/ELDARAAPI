const planService = require('../services/plan.service');

const listPlans = async (req, res, next) => {
  try {
    const plans = await planService.listActivePlans();

    return res.status(200).json({
      success: true,
      message: 'Plans fetched successfully',
      data: plans,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPlans,
};
