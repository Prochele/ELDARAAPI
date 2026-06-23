

// const authService = require('../services/auth.service');
// const { successResponse } = require('../utils/response.util');

// const authenticateUser = async (req, res, next) => {
//   try {


//     const result = await authService.authenticateUserService(req.body);
//     //console.log(result.data);
//     return successResponse(
//       res,
//       result.message,
//       result.data
//     );

//   } catch (error) {
//     next(error);
//   }
// };

// module.exports = {
//   authenticateUser,
// };

const authService = require('../services/auth.service');
const { successResponse } = require('../utils/response.util');


const generateLoginOtp = async (req, res, next) => {
  try {
    console.log("🔥 generateLoginOtp API HIT", req.body);
    const { mobileNumber, otp, deviceUUID, platform, appVersion } = req.body;

    if (otp) {
      const result = await authService.authenticateUserService({
        identifier: mobileNumber,
        otp,
        deviceUUID,
        platform,
        appVersion,
      });

      return res.status(200).json(result);
    }

    const result = await authService.generateLoginOtp(mobileNumber);
    console.log(result);
    return res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    next(error);
  }
};

const verifyLoginOtp = async (req, res, next) => {
  try {
    const { mobileNumber, otp } = req.body;

    const result = await authService.verifyLoginOtp(mobileNumber, otp);

    return res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    next(error);
  }
};

const completeLoginOtp = async (req, res, next) => {
  try {
    const {
      mobileNumber,
      code,
      deviceUUID,
      platform,
      appVersion,
    } = req.query;

    const result = await authService.authenticateUserService({
      identifier: mobileNumber,
      otp: code,
      deviceUUID,
      platform,
      appVersion,
    });

    return res.status(200).json(result);

  } catch (error) {
    next(error);
  }
};

const authenticateUser = async (req, res, next) => {
  try {
    const result = await authService.authenticateUserService(req.body);

    return successResponse(
      res,
      result.message,
      result.data
    );

  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateLoginOtp,
  verifyLoginOtp,
  completeLoginOtp,
  authenticateUser,
};
