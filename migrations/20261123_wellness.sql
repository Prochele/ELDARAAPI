-- Additive Wellness schema. Apply to a backed-up database before deploying the API.
-- User references are validated by the access service (also supports an isolated local data store).
CREATE TABLE IF NOT EXISTS WellnessCheckIn (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY,
  PatronID BIGINT NOT NULL,
  CheckInDate DATE NOT NULL,
  Feeling ENUM('well','okay','unwell') NOT NULL,
  SleepMinutes SMALLINT NULL,
  SleepQuality ENUM('rested','fair','poor','not-recorded') NOT NULL,
  Mood ENUM('happy','calm','low','worried') NOT NULL,
  PainLevel TINYINT NOT NULL,
  PainLocation VARCHAR(160) NOT NULL DEFAULT '',
  Notes VARCHAR(1000) NOT NULL DEFAULT '',
  EnteredByID BIGINT NOT NULL,
  UpdatedByID BIGINT NOT NULL,
  CreatedAt DATETIME(3) NOT NULL,
  UpdatedAt DATETIME(3) NOT NULL,
  Version INT NOT NULL DEFAULT 1,
  UNIQUE KEY uq_wellness_day (PatronID,CheckInDate),
  INDEX ix_wellness_expiry (CheckInDate),
  CHECK (SleepMinutes IS NULL OR SleepMinutes BETWEEN 0 AND 1440),
  CHECK (PainLevel BETWEEN 0 AND 10)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS WellnessCheckInEdit (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CheckInID BIGINT NOT NULL,
  ChangedByID BIGINT NOT NULL,
  ChangedAt DATETIME(3) NOT NULL,
  PreviousVersion INT NOT NULL,
  Snapshot JSON NOT NULL,
  INDEX ix_wellness_edits (CheckInID,ID),
  FOREIGN KEY (CheckInID) REFERENCES WellnessCheckIn(ID) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS WellnessAssistance (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY,
  PatronID BIGINT NOT NULL,
  RequestedByID BIGINT NOT NULL,
  UpdatedByID BIGINT NOT NULL,
  Category ENUM('daily-support','transport','appointment','other') NOT NULL,
  Description VARCHAR(1000) NOT NULL,
  State ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  CreatedAt DATETIME(3) NOT NULL,
  UpdatedAt DATETIME(3) NOT NULL,
  ResolvedAt DATETIME(3) NULL,
  Version INT NOT NULL DEFAULT 1,
  INDEX ix_wellness_assistance (PatronID,ID),
  INDEX ix_wellness_resolved (State,ResolvedAt),
  CHECK ((State='resolved' AND ResolvedAt IS NOT NULL) OR (State<>'resolved' AND ResolvedAt IS NULL))
) ENGINE=InnoDB;
