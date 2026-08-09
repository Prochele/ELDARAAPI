const accountService = require('../services/account.service');
const responseUtil = require('../utils/response.util');

const getProfile = async (req, res, next) => {
  try {
    const profile = await accountService.getProfile(req.user.UserID);

    if (!profile) {
      return responseUtil.errorResponse(res, 'Profile not found', 404);
    }

    return responseUtil.successResponse(res, 'Profile fetched', profile);
  } catch (error) {
    next(error);
  }
};

const updateEmail = async (req, res, next) => {
  try {
    const result = await accountService.updateEmail(
      req.user.UserID,
      req.body.emailId
    );

    if (!result || result.IsSuccess === 0) {
      return responseUtil.errorResponse(
        res,
        result?.Message || 'Unable to update email',
        400
      );
    }

    return responseUtil.successResponse(res, result.Message, result);
  } catch (error) {
    next(error);
  }
};

const updatePhone = async (req, res, next) => {
  try {
    const result = await accountService.updatePhone(
      req.user.UserID,
      req.body.mobileNumber
    );

    if (!result || result.IsSuccess === 0) {
      return responseUtil.errorResponse(
        res,
        result?.Message || 'Unable to update phone number',
        400
      );
    }

    return responseUtil.successResponse(res, result.Message, result);
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const result = await accountService.updatePlan(
      req.user.UserID,
      req.body.planId,
      req.body.paymentTransactionId
    );

    if (!result || result.IsSuccess === 0) {
      return responseUtil.errorResponse(
        res,
        result?.Message || 'Unable to update plan',
        400
      );
    }

    return responseUtil.successResponse(res, result.Message, result);
  } catch (error) {
    next(error);
  }
};

const removeAccount = async (req, res, next) => {
  try {
    const result = await accountService.removeAccount(req.user.UserID);

    if (!result || result.IsSuccess === 0) {
      return responseUtil.errorResponse(
        res,
        result?.Message || 'Unable to remove account',
        400
      );
    }

    return responseUtil.successResponse(res, result.Message, result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateEmail,
  updatePhone,
  updatePlan,
  removeAccount,
};
