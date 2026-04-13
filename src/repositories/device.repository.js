const db = require('../config/db');

const saveDeviceToken = async (data) => {
  const {
    userId,
    deviceUUID,
    platform,
    osVersion,
    appVersion,
    pushToken
  } = data;

  const [rows] = await db.query(
    `CALL sp_upsert_user_device_token(?,?,?,?,?,?)`,
    [
      userId,
      deviceUUID,
      platform,
      osVersion,
      appVersion,
      pushToken
    ]
  );

  return rows;
};

module.exports = {
  saveDeviceToken,
};