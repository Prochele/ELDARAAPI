
const dailyActivityService = require('../services/dailyActivity.service');
const { successResponse } = require('../utils/response.util');


const addDailyActivity = async (req, res, next) => {
  try {
    const userId = req.user.UserID;

    const result = await dailyActivityService.addDailyActivity(userId, req.body);

    return successResponse(
      res,
      'Daily activity added successfully',
      result
    );
  } catch (error) {
    next(error);
  }

};


const getDailyActivities = async (req, res, next) => {
  try {
    const userId = req.user.UserID; // from auth middleware

    const result = await dailyActivityService.getDailyActivitiesService(userId);

    return successResponse(
      res,
      result.message,
      result.data
    );
  } catch (error) {
    next(error);
  }
};

const deleteDailyActivity = async (req, res, next) => {
  try {
    const userId = req.user.UserID;
  
    const result = await dailyActivityService.deleteDailyActivity(userId, req.body);

    return successResponse(
      res,
      result.message
    );
  } catch (error) {
    next(error);
  }

};


module.exports = {
  addDailyActivity,
  getDailyActivities,
  deleteDailyActivity,
};