// src/controllers/medicine.controller.js

const medicineService = require('../services/medicine.service');
const { successResponse } = require('../utils/response.util');

const addMedicineSchedule = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      createdBy: req.user.UserID   // ✅ enforce from session
    };

    const result = await medicineService.addMedicineSchedule(payload);
    console.log('Medicine schedule created:........', result);
    return successResponse(
      res,
      'Medicine schedule created successfully',
      result
    );
  } catch (error) {
    console.error('Error creating medicine schedule:.......', error);
    next(error);
  }
};

const logMedicineStatus = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      userId: req.user.UserID
    };

    const result = await medicineService.logMedicineStatus(payload);

    return successResponse(res, 'Status updated', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addMedicineSchedule,
  logMedicineStatus
};