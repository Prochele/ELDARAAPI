const deviceService = require('../services/device.service');
const { successResponse } = require('../utils/response.util');

const saveDeviceToken = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      userId: req.user.UserID,   // enforce from session
      sessionToken: req.headers.authorization.replace('Bearer ', ''),
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

const getMedicineReminderNotifications = async (req, res, next) => {
  try {
    const result = await deviceService.getMedicineReminderNotifications(
      req.user.UserID
    );

    return successResponse(
      res,
      'Medicine reminder notification preference fetched successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

const updateMedicineReminderNotifications = async (req, res, next) => {
  try {
    const result = await deviceService.updateMedicineReminderNotifications(
      req.user.UserID,
      req.body
    );

    return successResponse(
      res,
      'Medicine reminder notification preference updated successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  saveDeviceToken,
  getMedicineReminderNotifications,
  updateMedicineReminderNotifications,
  getScheduleReminderNotifications: async (req, res, next) => {
    try {
      return successResponse(res, 'Schedule notification preferences fetched',
        await deviceService.getScheduleReminderNotifications(req.user.UserID));
    } catch (error) { next(error); }
  },
  updateScheduleReminderNotifications: async (req, res, next) => {
    try {
      return successResponse(res, 'Schedule notification preferences updated',
        await deviceService.updateScheduleReminderNotifications(req.user.UserID, req.body));
    } catch (error) { next(error); }
  },
  unregisterScheduleDevice: async (req, res, next) => {
    try {
      await deviceService.unregisterScheduleDevice(req.user.UserID, req.params.deviceUUID);
      return successResponse(res, 'Schedule notifications unregistered');
    } catch (error) { next(error); }
  },
};
