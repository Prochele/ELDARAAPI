const caretakerService = require('../services/caretaker.service');
const responseUtil = require('../utils/response.util');

const getRegisteredCaretakers = async (req, res, next) => {
  try {
    const caretakers = await caretakerService.getRegisteredCaretakers(req.query.search || '');
    return responseUtil.successResponse(res, 'Caretakers fetched', caretakers);
  } catch (error) {
    next(error);
  }
};

const getAssignedCaretakers = async (req, res, next) => {
  try {
    const caretakers = await caretakerService.getAssignedCaretakers(
      req.user.UserID,
      Number(req.query.patronId)
    );

    return responseUtil.successResponse(res, 'Assigned caretakers fetched', caretakers);
  } catch (error) {
    next(error);
  }
};

const assignCaretaker = async (req, res, next) => {
  try {
    const result = await caretakerService.assignCaretaker({
      ptaUserId: req.user.UserID,
      patronId: Number(req.body.patronId),
      caretakerCode: req.body.caretakerCode,
    });

    if (!result.success) {
      return responseUtil.errorResponse(res, result.message, 400);
    }

    return responseUtil.successResponse(res, result.message, result);
  } catch (error) {
    next(error);
  }
};

const rateCaretaker = async (req, res, next) => {
  try {
    const result = await caretakerService.rateCaretaker({
      ptaUserId: req.user.UserID,
      patronId: Number(req.body.patronId),
      caretakerId: Number(req.body.caretakerId),
      rating: Number(req.body.rating),
      comments: req.body.comments,
    });

    if (!result.success) {
      return responseUtil.errorResponse(res, result.message, 400);
    }

    return responseUtil.successResponse(res, result.message, result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRegisteredCaretakers,
  getAssignedCaretakers,
  assignCaretaker,
  rateCaretaker,
};
