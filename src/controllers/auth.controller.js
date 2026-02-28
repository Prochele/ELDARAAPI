// // const authenticateUser = async (req, res, next) => {
//   try {

//     console.log("===== REQUEST BODY =====");
//     console.log(req.body);
//     console.log("========================");

//     const result = await authService.authenticateUserService(req.body);

//     return successResponse(
//       res,
//       result.message,
//       result.data
//     );
//   } catch (error) {
//     next(error);
//   }
// };

const authService = require('../services/auth.service');
const { successResponse } = require('../utils/response.util');

const authenticateUser = async (req, res, next) => {
  try {


    const result = await authService.authenticateUserService(req.body);
    //console.log(result.data);
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
  authenticateUser,
};