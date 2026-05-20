const db = require('../config/db');

const addDailyActivity = async (userId, activityDate, activityTime, categoryId, activityDescription, createdby) => {
  const [rows] = await db.query(
    'CALL USP_AddDailyActivity(?, ?, ?, ?, ?, ?)',
    [userId, activityDate, activityTime, categoryId, activityDescription, createdby]
  );

  return rows[0][0]; // returning inserted ID
};


const getDailyActivities = async (userId, roleCode, patronId) => {
  const isPatronView = roleCode === 'PT' || Boolean(patronId);
  const filterColumn = isPatronView ? 'DA.UserId' : 'DA.CreatedBy';
  const filterValue = isPatronView ? (patronId || userId) : userId;

  const [rows] = await db.query(
    `SELECT 
        DA.DailyActivityId,
        DA.ActivityDate,
        DA.ActivityTime,
        AC.CategoryName,
        DA.ActivityDescription,
        DA.IsNotified,
        DA.CreatedAt,
        TRIM(CONCAT(IFNULL(UM.FirstName, ''), ' ', IFNULL(UM.LastName, ''))) AS FullName
    FROM DailyActivity DA
    INNER JOIN ActivityCategoryMaster AC
        ON DA.CategoryId = AC.CategoryId
    JOIN UserMaster UM
        ON UM.UserId = DA.UserId
    WHERE ${filterColumn} = ?
    ORDER BY DA.ActivityDate ASC, DA.ActivityTime ASC`,
    [filterValue]
  );

  return rows;
};

const deleteDailyActivity = async (userId, activityID) => {
  const [rows] = await db.query(
    'CALL sp_delete_daily_activity(?, ?)',
    [userId, activityID]
  );

  return rows[0][0]; // returning inserted ID
};

module.exports = {
  addDailyActivity,
  getDailyActivities,
  deleteDailyActivity,
};
