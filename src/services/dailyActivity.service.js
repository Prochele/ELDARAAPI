const dailyActivityRepository = require('../repositories/dailyActivity.repository');
const logger = require('../utils/logger.util');
const addDailyActivity = async (userId, body) => {
  const { activityDate, activityTime, categoryId, activityDescription } = body;

  if (!activityDate || !activityTime || !categoryId || !activityDescription) {
    throw new Error('All fields are required');
  }

  const result = await dailyActivityRepository.addDailyActivity(
    userId,
    activityDate,
    activityTime,
    categoryId,
    activityDescription
  );

  return result;
};

// const deleteDailyActivity = async (userId, body) => {
//  const { activityID } = body
//   if (!userId || !activityID) {
//     throw new Error('All fields are required');
//   }
//   logger.info('activity ID', {
//     message: activityID,
//   });
//   const result = await dailyActivityRepository.deleteDailyActivity(
//     userId,
//     activityID,
//   );

//   return result;
// };

const deleteDailyActivity = async (userId, body) => {
  const { dailyActivityId } = body;

  if (!dailyActivityId) {
    throw new Error('DailyActivityId is required');
  }

  const result =
    await dailyActivityRepository.deleteDailyActivity(
      userId,
      dailyActivityId
    );

  return {
    message: result.message || 'Deleted successfully',
  };
};


const getDailyActivitiesService = async (userId) => {

  const activities = await dailyActivityRepository.getDailyActivities(userId);
  logger.info('User ID', {
    message: userId,
  });
  return {
    message: 'Daily activities fetched successfully',
    data: activities,
  };
};

module.exports = {
  addDailyActivity,
  getDailyActivitiesService,
  deleteDailyActivity,
};