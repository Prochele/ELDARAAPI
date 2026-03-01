const signupService = require('../services/signup.service');

const signup = async (req, res, next) => {
  try {
    const response = await signupService.registerUser(req.body);

    if (!response.success) {
      return res.status(400).json(response);
    }

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
};