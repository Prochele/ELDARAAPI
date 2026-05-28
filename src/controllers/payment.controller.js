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
    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to create Premium payment order',
      data: null,
    });
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
    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to verify payment',
      data: null,
    });
  }
};

module.exports = {
  createPremiumOrder,
  verifyPayment,
};
