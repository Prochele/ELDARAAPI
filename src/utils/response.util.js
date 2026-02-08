/**
 * Standard API response utility
 */

const successResponse = (res, message, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
