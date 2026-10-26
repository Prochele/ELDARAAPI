const deviceRepository = require('../repositories/device.repository');
const { createMorningReminderRepository } = require('../repositories/morningReminder.repository');
const scheduleRepository = createMorningReminderRepository();

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

  await deviceRepository.saveDeviceToken({
    userId,
    deviceUUID,
    platform,
    osVersion,
    appVersion,
    pushToken
  });

  let scheduleRemindersRegistered = false;
  try {
    await scheduleRepository.registerDevice(userId, deviceUUID, pushToken,
      body.supportsScheduleReminders === true, body.sessionToken);
    scheduleRemindersRegistered = body.supportsScheduleReminders === true;
  } catch (error) {
    // Older deployments can still register medicine push tokens before the migration is applied.
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return { userId, scheduleRemindersRegistered };
};

const getScheduleReminderNotifications = async (userId) => {
  if (!userId) throw new Error('userId is required');
  return scheduleRepository.getPreferences(userId);
};

const updateScheduleReminderNotifications = async (userId, body) => {
  if (!userId) throw new Error('userId is required');
  if (typeof body?.appointmentRemindersEnabled !== 'boolean' ||
      typeof body?.activityRemindersEnabled !== 'boolean') {
    throw new Error('Both schedule reminder preferences must be boolean');
  }
  const preferences = {
    appointmentRemindersEnabled: body.appointmentRemindersEnabled,
    activityRemindersEnabled: body.activityRemindersEnabled,
  };
  await scheduleRepository.updatePreferences(userId, preferences);
  return preferences;
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
  getScheduleReminderNotifications,
  updateScheduleReminderNotifications,
  unregisterScheduleDevice: (userId, deviceUUID) => {
    if (!userId || !deviceUUID || deviceUUID.length > 100) throw new Error('Invalid device');
    return scheduleRepository.unregisterDevice(userId, deviceUUID);
  },
};
