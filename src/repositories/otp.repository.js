const db = require('../config/db');

/**
 * Generate OTP
 * Calls: sp_generate_signup_otp
 */
exports.generateOtp = async (contactType, contactValue, otp) => {
  try {
    const sql = `CALL sp_generate_signup_otp(?, ?, ?)`;

    await db.query(sql, [
      contactType,
      contactValue,
      otp
    ]);

    return true;

  } catch (error) {
    throw error;
  }
};


/**
 * Verify OTP
 * Calls: sp_verify_signup_otp
 * Returns: { IsValid, Message }
 */
exports.verifyOtp = async (contactType, contactValue, otp) => {
  try {
    const sql = `CALL sp_verify_signup_otp(?, ?, ?)`;

    const [rows] = await db.query(sql, [
      contactType,
      contactValue,
      otp
    ]);

    /**
     * MySQL CALL returns nested array:
     * rows[0] = resultset array
     * rows[0][0] = first row
     */

    if (!rows || !rows[0] || !rows[0][0]) {
      return null;
    }

    return rows[0][0];

  } catch (error) {
    throw error;
  }
};