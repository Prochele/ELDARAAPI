const paymentService = require('../services/payment.service');

const createOrderForPayload = async (payload, res) => {
  try {
    const order = await paymentService.createRazorpayOrder(payload);

    return res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: order,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to create payment order',
      data: null,
    });
  }
};

const createOrder = async (req, res) => {
  return createOrderForPayload(req.body || {}, res);
};

// Backward compatibility for app versions that only supported Premium.
const createPremiumOrder = async (req, res) => {
  return createOrderForPayload({ ...(req.body || {}), planId: 3 }, res);
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

const recordPaymentFailure = async (req, res, next) => {
  try {
    const result = await paymentService.recordPaymentFailure(req.body || {});

    return res.status(result.success ? 200 : 400).json({
      ...result,
      data: null,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to record payment failure',
      data: null,
    });
  }
};

module.exports = {
  createOrder,
  createPremiumOrder,
  recordPaymentFailure,
  verifyPayment,
};
