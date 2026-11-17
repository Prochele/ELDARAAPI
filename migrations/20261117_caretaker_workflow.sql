-- Additive migration. Do not drop/replace existing tables, routines or health data.
-- Run once under the migration runner after a verified full backup.
CREATE TABLE IF NOT EXISTS CareWorkPreferences (
  CaretakerID BIGINT PRIMARY KEY,
  Accepting TINYINT NOT NULL DEFAULT 1,
  WorkType ENUM('either','full-time','part-time') NOT NULL DEFAULT 'either',
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (CaretakerID) REFERENCES UserMaster(UserID),
  CHECK (Accepting IN (0,1))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareAvailability (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY, CaretakerID BIGINT NOT NULL,
  Weekday TINYINT NOT NULL, FromMinute SMALLINT NOT NULL, ToMinute SMALLINT NOT NULL,
  INDEX ix_care_availability(CaretakerID,Weekday),
  FOREIGN KEY (CaretakerID) REFERENCES UserMaster(UserID),
  CHECK (Weekday BETWEEN 0 AND 6 AND FromMinute>=0 AND ToMinute<=1439 AND FromMinute<ToMinute)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareLeave (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY, CaretakerID BIGINT NOT NULL,
  FromDate DATE NOT NULL, ToDate DATE NOT NULL,
  INDEX ix_care_leave(CaretakerID,FromDate,ToDate),
  FOREIGN KEY (CaretakerID) REFERENCES UserMaster(UserID),
  CHECK (FromDate<=ToDate)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareContact (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY, PTAID BIGINT NOT NULL, CaretakerID BIGINT NOT NULL,
  State ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  Introduction VARCHAR(1000) NOT NULL, CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PTAReadID BIGINT NOT NULL DEFAULT 0, CaretakerReadID BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_care_pair(PTAID,CaretakerID), INDEX ix_care_requests(PTAID,CreatedAt),
  FOREIGN KEY (PTAID) REFERENCES UserMaster(UserID),
  FOREIGN KEY (CaretakerID) REFERENCES UserMaster(UserID)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareMessage (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY, ContactID BIGINT NOT NULL, SenderID BIGINT NOT NULL,
  Body VARCHAR(2000) NOT NULL, ClientID VARCHAR(80) NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_care_message(SenderID,ClientID), INDEX ix_care_messages(ContactID,ID),
  FOREIGN KEY (ContactID) REFERENCES CareContact(ID),
  FOREIGN KEY (SenderID) REFERENCES UserMaster(UserID)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareBlock (
  OwnerID BIGINT NOT NULL, OtherID BIGINT NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(OwnerID,OtherID),
  FOREIGN KEY (OwnerID) REFERENCES UserMaster(UserID),
  FOREIGN KEY (OtherID) REFERENCES UserMaster(UserID)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareReport (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY, ContactID BIGINT NOT NULL, ReporterID BIGINT NOT NULL,
  Reason VARCHAR(1000) NOT NULL, State ENUM('open','reviewed') NOT NULL DEFAULT 'open',
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ReviewedAt DATETIME NULL,
  ReviewedBy BIGINT NULL, INDEX ix_care_reports(State,CreatedAt),
  FOREIGN KEY (ContactID) REFERENCES CareContact(ID),
  FOREIGN KEY (ReporterID) REFERENCES UserMaster(UserID)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareAssignment (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY, PTAID BIGINT NOT NULL, PatronID BIGINT NOT NULL,
  CaretakerID BIGINT NOT NULL,
  State ENUM('pending','active','declined','ended') NOT NULL DEFAULT 'pending',
  Kind ENUM('once','weekly','legacy') NOT NULL,
  WorkType ENUM('full-time','part-time') NOT NULL DEFAULT 'part-time',
  FromDate DATE NOT NULL, ToDate DATE NULL, Weekdays JSON NOT NULL,
  FromMinute SMALLINT NULL, ToMinute SMALLINT NULL, Notes VARCHAR(1000) NOT NULL DEFAULT '',
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ConfirmedAt DATETIME NULL,
  EndedAt DATETIME NULL, LegacyMappingID BIGINT NULL,
  UNIQUE KEY uq_care_legacy(LegacyMappingID),
  INDEX ix_care_assignment(CaretakerID,State,FromDate,ToDate),
  INDEX ix_care_patron(PatronID,State),
  FOREIGN KEY (PTAID) REFERENCES UserMaster(UserID),
  FOREIGN KEY (PatronID) REFERENCES UserMaster(UserID),
  FOREIGN KEY (CaretakerID) REFERENCES UserMaster(UserID),
  CHECK (ToDate IS NULL OR FromDate<=ToDate),
  CHECK (Kind='legacy' OR (FromMinute>=0 AND ToMinute<=1439 AND FromMinute<ToMinute))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareReview (
  AssignmentID BIGINT PRIMARY KEY, Rating TINYINT NOT NULL, Feedback VARCHAR(1000) NOT NULL DEFAULT '',
  Reply VARCHAR(1000) NOT NULL DEFAULT '', CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, RepliedAt DATETIME NULL,
  FOREIGN KEY (AssignmentID) REFERENCES CareAssignment(ID),
  CHECK (Rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS CareNotice (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY, RecipientID BIGINT NOT NULL,
  Target ENUM('inbox','assignments','reviews') NOT NULL, ReferenceID BIGINT NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, SentAt DATETIME NULL,
  Attempts TINYINT NOT NULL DEFAULT 0, NextAttemptAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_care_notice(SentAt,NextAttemptAt),
  FOREIGN KEY (RecipientID) REFERENCES UserMaster(UserID)
) ENGINE=InnoDB;

-- Preserve existing live assignments without inventing working hours or requiring re-approval.
-- Legacy commitments must be ended/replaced with agreed hours before new scheduling.
INSERT INTO CareAssignment
 (PTAID,PatronID,CaretakerID,State,Kind,FromDate,Weekdays,CreatedAt,ConfirmedAt,LegacyMappingID)
SELECT CreatedBy,PatronId,CaretakerId,'active','legacy',DATE(CreatedOn),JSON_ARRAY(),CreatedOn,CreatedOn,CaretakerPatronMappingId
FROM CaretakerPatronMapping M WHERE IsActive=1
AND NOT EXISTS (SELECT 1 FROM CareAssignment A WHERE A.LegacyMappingID=M.CaretakerPatronMappingId
 OR (A.PatronID=M.PatronId AND A.CaretakerID=M.CaretakerId AND A.State='active'));
