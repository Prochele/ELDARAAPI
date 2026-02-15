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
      `SELECT UserID
       FROM UserTokens
       WHERE AccessToken = ?
         AND IsActive = TRUE
         AND ExpiryOn > NOW()
       LIMIT 1`,
      [accessToken]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Invalid or expired session', 401);
    }

    req.user = {
      UserID: rows[0].UserID
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticateSession;
