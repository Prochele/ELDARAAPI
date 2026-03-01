const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticateSchema } = require('../constants/auth.validation');
const { authRateLimiter } = require('../middlewares/rateLimit.middleware');


/**
 * POST /api/auth/login
 */

router.post('/login/generate-otp', authController.generateLoginOtp);
router.post('/login/verify-otp', authController.verifyLoginOtp);
router.post(
  '/login',
  authRateLimiter,
  validate(authenticateSchema),
  authController.authenticateUser
);

module.exports = router;
