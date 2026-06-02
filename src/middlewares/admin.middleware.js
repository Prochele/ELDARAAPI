const adminRepository = require('../repositories/admin.repository');
const { errorResponse } = require('../utils/response.util');

const authenticateAdmin = async (req, res, next) => {
  try {
    const tokenHeader = req.headers.authorization;

    if (!tokenHeader) {
      return errorResponse(res, 'Admin session token required', 401);
    }

    const token = tokenHeader.replace('Bearer ', '');
    const admin = await adminRepository.findAdminByToken(token);

    if (!admin) {
      return errorResponse(res, 'Invalid admin session', 401);
    }

    req.admin = admin;
    req.adminToken = token;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticateAdmin;
