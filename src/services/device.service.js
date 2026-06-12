const deviceRepository = require('../repositories/device.repository');

const saveDeviceToken = async (body) => {
  if (typeof body !== 'object') {
    throw new Error('Invalid request body');
  }

  const {
    userId,
    deviceUUID,
    platform,
    osVersion,
    appVersion,
    pushToken
  } = body;

  if (!userId) throw new Error('userId is required');
  if (!deviceUUID) throw new Error('deviceUUID is required');
  if (!pushToken) throw new Error('pushToken is required');

  return await deviceRepository.saveDeviceToken({
    userId,
    deviceUUID,
    platform,
    osVersion,
    appVersion,
    pushToken
  });
};

const getMedicineReminderNotifications = async (userId) => {
  if (!userId) throw new Error('userId is required');

  const result = await deviceRepository.getMedicineReminderNotifications(userId);

  return {
    medicineReminderNotificationsEnabled:
      result.MedicineReminderNotificationsEnabled === 1 ||
      result.MedicineReminderNotificationsEnabled === true,
  };
};

const updateMedicineReminderNotifications = async (userId, body) => {
  if (!userId) throw new Error('userId is required');
  if (typeof body?.enabled !== 'boolean') {
    throw new Error('enabled is required');
  }

  await deviceRepository.updateMedicineReminderNotifications(userId, body.enabled);

  return {
    medicineReminderNotificationsEnabled: body.enabled,
  };
};

module.exports = {
  saveDeviceToken,
  getMedicineReminderNotifications,
  updateMedicineReminderNotifications,
};
