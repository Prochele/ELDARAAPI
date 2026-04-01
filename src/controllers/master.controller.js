// src/controllers/master.controller.js

const masterService = require('../services/master.service');
const { successResponse } = require('../utils/response.util');

const getMedicineTypes = async (req, res, next) => {
  try {
    const result = await masterService.getMedicineTypes();
    return successResponse(res, 'Medicine types fetched', result);
  } catch (error) {
    next(error);
  }
};

const getMedicineSchedulesTypes = async (req, res, next) => {
  try {
    const result = await masterService.getMedicineSchedulesTypes();
    return successResponse(res, 'Medicine schedules types fetched', result);
  } catch (error) {
    next(error);
  }
};

const getIntakeTypes = async (req, res, next) => {
  try {
    const result = await masterService.getIntakeTypes();
    return successResponse(res, 'Intake types fetched', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMedicineTypes,
  getMedicineSchedulesTypes,
  getIntakeTypes,
};