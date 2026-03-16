const patronService = require('../services/patron.service');
const responseUtil = require('../utils/response.util');

const createPatron = async (req, res, next) => {
  try {

    const ptaUserId = req.user.UserID;

    const data = {
      ptaUserId,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      mobileNumber: req.body.mobileNumber,
      emailId: req.body.emailId,
      genderId: req.body.genderId,
      dob: req.body.dob,
      countryId: req.body.countryId,
      provinceId: req.body.provinceId,
      districtId: req.body.districtId,
      cityId: req.body.cityId,
      areaId: req.body.areaId
    };

    const result = await patronService.createPatron(data);

    if (result.IsSuccess === 0) {
      return responseUtil.errorResponse(res, result.Message, 400);
    }

    return responseUtil.successResponse(res, result, result.Message);

  } catch (error) {
    next(error);
  }
};

const getPatronList = async (req, res, next) => {
  try {

    const ptaUserId = req.user.UserID;

    const patrons = await patronService.getPatronList(ptaUserId);
    console.log("Patron List:", patrons);

    return responseUtil.successResponse(res, 'Patron list fetched', patrons);

  } catch (error) {
    next(error);
  }
};

/* ================= GET PATRON DETAILS ================= */

const getPatronDetails = async (req, res, next) => {
  try {

    const ptaUserId = req.user.UserID;
    const patronId = req.params.patronId;

    const patron = await patronService.getPatronDetails(ptaUserId, patronId);

    if (!patron || patron.IsSuccess === 0) {
      return responseUtil.errorResponse(
        res,
        patron?.Message || 'Patron not found',
        404
      );
    }


    return responseUtil.successResponse(res, 'Patron details fetched', patron);

  } catch (error) {
    next(error);
  }
};

/* ================= DELETE PATRON ================= */

const deletePatron = async (req, res, next) => {
  try {

    const ptaUserId = req.user.UserID;
    const patronId = req.body.patronId;

    const result = await patronService.deletePatron(ptaUserId, patronId);

    if (!result.success) {
      return responseUtil.errorResponse(res, result.message, 400);
    }

    return responseUtil.successResponse(res, result.message, result);

  } catch (error) {
    next(error);
  }
};

/* ================= CHECK PATRON LIMIT ================= */

const checkPatronLimit = async (req, res, next) => {
  try {

    const ptaUserId = req.user.UserID;

    const result = await patronService.checkPatronLimit(ptaUserId);
    

    return responseUtil.successResponse(res, 'Patron limit fetched', result);

  } catch (error) {
    next(error);
  }
};


module.exports = {
  createPatron,
  getPatronList,
  getPatronDetails,
  deletePatron,
  checkPatronLimit

};