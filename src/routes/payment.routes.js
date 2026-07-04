const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');

router.post('/order', paymentController.createOrder);
router.post('/premium/order', paymentController.createPremiumOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/failure', paymentController.recordPaymentFailure);

module.exports = router;
