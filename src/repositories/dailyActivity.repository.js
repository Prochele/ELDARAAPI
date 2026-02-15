const db = require('../config/db');

const addDailyActivity = async (userId, activityDate, activityTime, categoryId, activityDescription) => {
  const [rows] = await db.query(
    'CALL USP_AddDailyActivity(?, ?, ?, ?, ?)',
    [userId, activityDate, activityTime, categoryId, activityDescription]
  );

  return rows[0][0]; // returning inserted ID
};


const getDailyActivities = async (userId) => {
  const [rows] = await db.query(
    'CALL sp_get_daily_activities(?)',
    [userId]
  );

  return rows[0];
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