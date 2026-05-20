const db = require('../config/db');
const { errorResponse } = require('../utils/response.util');

const authenticateSession = async (req, res, next) => {
  try {
    const token = req.headers['authorization'];

    if (!token) {
      return errorResponse(res, 'Session token required', 401);
    }

    const accessToken = token.replace('Bearer ', '');

    const [rows] = await db.query(
      `SELECT
         UT.UserID,
         RM.RoleCode
       FROM UserTokens UT
       LEFT JOIN UserRoleMapping URM
         ON URM.UserID = UT.UserID
       LEFT JOIN RoleMaster RM
         ON RM.RoleID = URM.RoleID
       WHERE UT.AccessToken = ?
         AND UT.IsActive = TRUE
       LIMIT 1`,
      [accessToken]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Invalid session', 401);
    }

    req.user = {
      UserID: rows[0].UserID,
      RoleCode: rows[0].RoleCode
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticateSession;
