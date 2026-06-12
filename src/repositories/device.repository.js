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

const getMedicineReminderNotifications = async (userId) => {
  const [rows] = await db.query(
    `SELECT COALESCE(MedicineReminderNotificationsEnabled, 1) AS MedicineReminderNotificationsEnabled
     FROM UserNotificationPreferences
     WHERE UserID = ?`,
    [userId]
  );

  return rows[0] || { MedicineReminderNotificationsEnabled: 1 };
};

const updateMedicineReminderNotifications = async (userId, enabled) => {
  const [rows] = await db.query(
    `INSERT INTO UserNotificationPreferences
       (UserID, MedicineReminderNotificationsEnabled)
     VALUES
       (?, ?)
     ON DUPLICATE KEY UPDATE
       MedicineReminderNotificationsEnabled = VALUES(MedicineReminderNotificationsEnabled),
       UpdatedOn = NOW()`,
    [userId, enabled ? 1 : 0]
  );

  return rows;
};

module.exports = {
  saveDeviceToken,
  getMedicineReminderNotifications,
  updateMedicineReminderNotifications,
};
