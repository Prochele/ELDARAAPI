const { randomUUID, createHash } = require('node:crypto');
const db = require('../config/db');

const createMorningReminderRepository = (pool = db) => ({
  async unregisterDevice(userId, deviceUUID) {
    await pool.query('DELETE FROM ScheduleReminderDevices WHERE UserID = ? AND DeviceUUID = ?',
      [userId, deviceUUID]);
  },

  async registerDevice(userId, deviceUUID, pushToken, supported, sessionToken) {
    if (!supported) {
      await pool.query('DELETE FROM ScheduleReminderDevices WHERE DeviceUUID = ?', [deviceUUID]);
      return;
    }
    await pool.query(`INSERT INTO ScheduleReminderDevices (DeviceUUID, UserID, PushTokenHash, SessionTokenHash)
      VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE UserID = VALUES(UserID),
      PushTokenHash = VALUES(PushTokenHash), SessionTokenHash = VALUES(SessionTokenHash), UpdatedOn = UTC_TIMESTAMP()`,
    [deviceUUID, userId, createHash('sha256').update(pushToken).digest('hex'),
      createHash('sha256').update(sessionToken).digest('hex')]);
  },

  async getPreferences(userId) {
    const [rows] = await pool.query(`SELECT AppointmentRemindersEnabled, ActivityRemindersEnabled
      FROM ScheduleNotificationPreferences WHERE UserID = ?`, [userId]);
    return {
      appointmentRemindersEnabled: rows.length ? Boolean(rows[0].AppointmentRemindersEnabled) : true,
      activityRemindersEnabled: rows.length ? Boolean(rows[0].ActivityRemindersEnabled) : true,
    };
  },

  async updatePreferences(userId, preferences) {
    await pool.query(`INSERT INTO ScheduleNotificationPreferences
      (UserID, AppointmentRemindersEnabled, ActivityRemindersEnabled) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE AppointmentRemindersEnabled = VALUES(AppointmentRemindersEnabled),
      ActivityRemindersEnabled = VALUES(ActivityRemindersEnabled), UpdatedOn = UTC_TIMESTAMP()`,
    [userId, preferences.appointmentRemindersEnabled, preferences.activityRemindersEnabled]);
  },

  async findEvents(date, time) {
    const [rows] = await pool.query(`
      SELECT 'DOCTOR_APPOINTMENT' AS ReminderType, DA.DoctorAppointmentId AS SourceID,
        DA.PatronId AS RecipientID, DA.AppointmentDate AS ScheduleDate,
        DA.AppointmentTime AS EventTime, DA.DoctorName AS Description
      FROM DoctorAppointment DA JOIN AppointmentStatusMaster S ON S.StatusId = DA.StatusId
      LEFT JOIN ScheduleNotificationPreferences P ON P.UserID = DA.PatronId
      WHERE DA.AppointmentDate = ? AND DA.AppointmentTime >= ?
        AND S.StatusName IN ('Scheduled', 'Rescheduled')
        AND COALESCE(P.AppointmentRemindersEnabled, 1) = 1
      UNION ALL
      SELECT 'DAILY_ACTIVITY', DA.DailyActivityId, DA.UserId, DA.ActivityDate,
        DA.ActivityTime, DA.ActivityDescription
      FROM DailyActivity DA LEFT JOIN ScheduleNotificationPreferences P ON P.UserID = DA.UserId
      WHERE DA.ActivityDate = ? AND DA.ActivityTime >= ?
        AND COALESCE(P.ActivityRemindersEnabled, 1) = 1
      ORDER BY RecipientID, EventTime, ReminderType, SourceID`, [date, time, date, time]);
    return rows;
  },

  async findDevices(userId) {
    const [rows] = await pool.query(`SELECT DISTINCT D.DeviceUUID, D.PushToken, D.Platform
      FROM UserDeviceInfo D JOIN UserMaster U ON U.UserID = D.UserID AND U.StatusID = 1
      JOIN ScheduleReminderDevices R ON R.DeviceUUID = D.DeviceUUID AND R.UserID = D.UserID
        AND R.PushTokenHash = SHA2(D.PushToken, 256)
      WHERE D.UserID = ? AND D.Platform IN ('ANDROID', 'IOS')
        AND D.PushToken IS NOT NULL AND D.PushToken != ''
        AND EXISTS (SELECT 1 FROM UserTokens T WHERE T.UserID = D.UserID
          AND SHA2(T.AccessToken, 256) = R.SessionTokenHash AND T.IsActive = TRUE)`, [userId]);
    return rows;
  },

  async claim(event, device) {
    const keys = [event.ScheduleDate, event.ReminderType, event.SourceID, event.RecipientID, device.DeviceUUID];
    await pool.query(`INSERT IGNORE INTO MorningReminderDeliveries
      (ScheduleDate, ReminderType, SourceID, RecipientID, DeviceUUID, NextAttemptAt)
      VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`, keys);
    const claimToken = randomUUID();
    // Atomic conditional update prevents overlapping workers from owning the same delivery.
    const [result] = await pool.query(`UPDATE MorningReminderDeliveries
      SET Status = 'sending', ClaimToken = ?, AttemptCount = AttemptCount + 1,
        LockedUntil = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
      WHERE ScheduleDate = ? AND ReminderType = ? AND SourceID = ? AND RecipientID = ? AND DeviceUUID = ?
        AND Status IN ('pending', 'retry', 'sending') AND AttemptCount < 5
        AND NextAttemptAt <= UTC_TIMESTAMP()
        AND (LockedUntil IS NULL OR LockedUntil < UTC_TIMESTAMP())`, [claimToken, ...keys]);
    return result.affectedRows === 1 ? claimToken : null;
  },

  async complete(claimToken) {
    await pool.query(`UPDATE MorningReminderDeliveries SET Status = 'sent', SentAt = UTC_TIMESTAMP(),
      LockedUntil = NULL, LastError = NULL WHERE ClaimToken = ? AND Status = 'sending'`, [claimToken]);
  },

  async fail(claimToken, code, permanent) {
    await pool.query(`UPDATE MorningReminderDeliveries SET Status = ?, LastError = ?, LockedUntil = NULL,
      NextAttemptAt = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 MINUTE)
      WHERE ClaimToken = ? AND Status = 'sending'`,
    [permanent ? 'failed' : 'retry', String(code || 'send-failed').slice(0, 100), claimToken]);
  },
});

module.exports = { createMorningReminderRepository };
