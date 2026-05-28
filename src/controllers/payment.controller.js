const paymentService = require('../services/payment.service');

const createPremiumOrder = async (req, res, next) => {
  try {
    const order = await paymentService.createRazorpayOrder(req.body || {});

    return res.status(200).json({
      success: true,
      message: 'Premium payment order created successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const result = await paymentService.verifyPayment(req.body || {});

    return res.status(result.success ? 200 : 400).json({
      ...result,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPremiumOrder,
  verifyPayment,
};
