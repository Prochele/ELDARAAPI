const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication APIs
 * Prevents brute-force attacks
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                 // 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    data: null,
  },
});

module.exports = {
  authRateLimiter,
};
