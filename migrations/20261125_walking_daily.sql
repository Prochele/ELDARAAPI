CREATE TABLE IF NOT EXISTS WalkingDailySnapshot (
  UserID BIGINT NOT NULL,
  SnapshotDate DATE NOT NULL,
  Steps INT NOT NULL,
  DistanceMeters INT NOT NULL,
  DistanceSource ENUM('device-estimate','step-estimate') NOT NULL,
  UpdatedAtUTC DATETIME(3) NOT NULL,
  PRIMARY KEY (UserID,SnapshotDate),
  KEY walking_daily_expiry (SnapshotDate),
  CONSTRAINT walking_daily_steps CHECK (Steps BETWEEN 0 AND 200000),
  CONSTRAINT walking_daily_distance CHECK (DistanceMeters BETWEEN 0 AND 200000),
  CONSTRAINT walking_daily_source CHECK (DistanceSource IN ('device-estimate','step-estimate'))
) ENGINE=InnoDB;
