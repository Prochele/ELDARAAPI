/**
 * Authentication Repository
 * Handles DB calls & stored procedure execution
 */

const db = require('../config/db');

const authenticateUserRepo = async (loginData) => {
  const {
    identifier,
    otp,
    roleId,
    deviceUUID,
    platform,
    appVersion,
  } = loginData;

  // OUT parameters
  let o_UserID = null;
  let o_UserName = null;
  let o_MobileNumber = null;
  let o_EmailID = null;
  let o_SessionToken = null;
  let o_Message = null;
  let o_IsValid = null;

  const sql = `
    CALL sp_authenticate_user(
      ?, ?, ?, ?, ?, ?,
      @o_UserID,
      @o_UserName,
      @o_MobileNumber,
      @o_EmailID,
      @o_SessionToken,
      @o_Message,
      @o_IsValid
    )
  `;

  const connection = await db.getConnection();

  try {
    // Execute stored procedure
    await connection.query(sql, [
      identifier,
      otp,
      roleId,
      deviceUUID,
      platform,
      appVersion,
    ]);

    // Fetch OUT parameters
    const [rows] = await connection.query(`
      SELECT
        @o_UserID        AS userId,
        @o_UserName      AS userName,
        @o_MobileNumber  AS mobileNumber,
        @o_EmailID       AS emailId,
        @o_SessionToken  AS sessionToken,
        @o_Message       AS message,
        @o_IsValid       AS isValid
    `);

    return rows[0];
  } finally {
    connection.release();
  }
};

module.exports = {
  authenticateUserRepo,
};
