const db = require('../config/db');

const getProfile = async (userId) => {
  const [rows] = await db.query('CALL sp_get_account_profile(?)', [userId]);
  return rows[0][0] || null;
};

const updateEmail = async (userId, emailId) => {
  const [rows] = await db.query('CALL sp_update_account_email(?, ?)', [
    userId,
    emailId,
  ]);
  return rows[0][0];
};

const updatePhone = async (userId, mobileNumber) => {
  const [rows] = await db.query('CALL sp_update_account_phone(?, ?)', [
    userId,
    mobileNumber,
  ]);
  return rows[0][0];
};

const removeAccount = async (userId) => {
  const [rows] = await db.query('CALL sp_remove_account(?)', [userId]);
  return rows[0][0];
};

module.exports = {
  getProfile,
  updateEmail,
  updatePhone,
  removeAccount,
};
