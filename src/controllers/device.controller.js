const deviceService = require('../services/device.service');
const { successResponse } = require('../utils/response.util');

const saveDeviceToken = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      userId: req.user.UserID   // enforce from session
    };

    const result = await deviceService.saveDeviceToken(payload);

    return successResponse(
      res,
      'Device token saved successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  saveDeviceToken,
};