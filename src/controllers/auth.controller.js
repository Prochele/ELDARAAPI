/**
 * Authentication Controller
 */

const authService = require('../services/auth.service');
const { successResponse } = require('../utils/response.util');

const authenticateUser = async (req, res, next) => {
  try {
    const result = await authService.authenticateUserService(req.body);

    return successResponse(
      res,
      result.message,
      result.data
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateUser,
};
