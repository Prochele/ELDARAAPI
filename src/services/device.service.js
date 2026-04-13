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

module.exports = {
  saveDeviceToken,
};