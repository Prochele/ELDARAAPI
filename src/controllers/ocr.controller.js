// src/controllers/ocr.controller.js

const ocrService = require('../services/ocr.service');
const { successResponse } = require('../utils/response.util');

const extractOCR = async (req, res, next) => {
  try {
    const userId = req.user.UserID;

    const result = await ocrService.extractOCR(userId, req.body);

    return successResponse(
      res,
      'OCR data extracted successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  extractOCR,
};