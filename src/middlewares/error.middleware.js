const logger = require('../utils/logger.util');

/**
 * Centralized error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled exception', {
    path: req.originalUrl,
    method: req.method,
    message: err.message,
  });

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

module.exports = errorHandler;
