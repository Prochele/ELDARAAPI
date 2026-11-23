CREATE TABLE IF NOT EXISTS WalkingGoal (
  UserID BIGINT NOT NULL PRIMARY KEY,
  DailySteps INT NULL,
  WeeklySteps INT NULL,
  StrideCm SMALLINT NOT NULL DEFAULT 65,
  Version INT NOT NULL DEFAULT 1,
  UpdatedAt DATETIME(3) NOT NULL,
  CONSTRAINT walking_goal_daily CHECK (DailySteps IS NULL OR DailySteps BETWEEN 100 AND 100000),
  CONSTRAINT walking_goal_weekly CHECK (WeeklySteps IS NULL OR WeeklySteps BETWEEN 100 AND 700000),
  CONSTRAINT walking_stride CHECK (StrideCm BETWEEN 20 AND 150)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS WalkingLog (
  ID BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID BIGINT NOT NULL,
  ClientID CHAR(36) NOT NULL,
  WalkDate DATE NOT NULL,
  Steps INT NOT NULL,
  DistanceMeters INT NULL,
  ActiveSeconds INT NOT NULL,
  Source ENUM('manual','sensor') NOT NULL,
  DistanceSource ENUM('device-estimate','step-estimate','manual','unavailable') NOT NULL,
  CreatedAt DATETIME(3) NOT NULL,
  UNIQUE KEY walking_retry (UserID,ClientID),
  KEY walking_owner_date (UserID,WalkDate,ID),
  KEY walking_expiry (WalkDate),
  CONSTRAINT walking_steps CHECK (Steps BETWEEN 0 AND 200000),
  CONSTRAINT walking_distance CHECK (DistanceMeters IS NULL OR DistanceMeters BETWEEN 0 AND 200000),
  CONSTRAINT walking_time CHECK (ActiveSeconds BETWEEN 0 AND 86400)
) ENGINE=InnoDB;
