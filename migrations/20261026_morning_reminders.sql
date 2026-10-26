-- Additive migration. Run against the existing application database before enabling the job.
-- Existing medicine tables, procedures and preferences are deliberately unchanged.
CREATE TABLE IF NOT EXISTS ScheduleNotificationPreferences (
  UserID BIGINT NOT NULL PRIMARY KEY,
  AppointmentRemindersEnabled BOOLEAN NOT NULL DEFAULT TRUE,
  ActivityRemindersEnabled BOOLEAN NOT NULL DEFAULT TRUE,
  UpdatedOn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Only clients that explicitly register support may receive the new payloads.
-- A device has one current owner, including when accounts switch on a shared phone.
CREATE TABLE IF NOT EXISTS ScheduleReminderDevices (
  DeviceUUID VARCHAR(100) NOT NULL PRIMARY KEY,
  UserID BIGINT NOT NULL,
  PushTokenHash CHAR(64) NOT NULL,
  SessionTokenHash CHAR(64) NOT NULL,
  UpdatedOn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX IX_ScheduleReminderDevices_User (UserID)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS MorningReminderDeliveries (
  DeliveryID BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ScheduleDate DATE NOT NULL,
  ReminderType VARCHAR(32) NOT NULL,
  SourceID BIGINT NOT NULL,
  RecipientID BIGINT NOT NULL,
  DeviceUUID VARCHAR(100) NOT NULL,
  Status VARCHAR(16) NOT NULL DEFAULT 'pending',
  AttemptCount INT NOT NULL DEFAULT 0,
  ClaimToken CHAR(36),
  LockedUntil DATETIME,
  NextAttemptAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  SentAt DATETIME,
  LastError VARCHAR(100),
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_MorningReminder (ScheduleDate, ReminderType, SourceID, RecipientID, DeviceUUID),
  INDEX IX_MorningReminderRetry (Status, NextAttemptAt)
) ENGINE=InnoDB;
