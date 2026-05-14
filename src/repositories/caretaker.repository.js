const db = require('../config/db');

const getRegisteredCaretakers = async (searchCode = '') => {
  const [rows] = await db.query(`CALL sp_get_registered_caretakers(?)`, [searchCode]);
  return rows[0] || [];
};

const getAssignedCaretakers = async (ptaUserId, patronId) => {
  const [rows] = await db.query(`CALL sp_get_assigned_caretakers(?, ?)`, [ptaUserId, patronId]);
  return rows[0] || [];
};

const assignCaretaker = async ({ ptaUserId, patronId, caretakerCode }) => {
  const [rows] = await db.query(`CALL sp_assign_caretaker(?, ?, ?)`, [
    ptaUserId,
    patronId,
    caretakerCode,
  ]);
  const result = rows[0]?.[0] || {};

  return {
    success: result.IsSuccess === 1,
    message: result.Message,
  };
};

const rateCaretaker = async ({ ptaUserId, patronId, caretakerId, rating, comments }) => {
  const [rows] = await db.query(`CALL sp_rate_caretaker(?, ?, ?, ?, ?)`, [
    ptaUserId,
    patronId,
    caretakerId,
    rating,
    comments || null,
  ]);
  const result = rows[0]?.[0] || {};

  return {
    success: result.IsSuccess === 1,
    message: result.Message,
  };
};

module.exports = {
  getRegisteredCaretakers,
  getAssignedCaretakers,
  assignCaretaker,
  rateCaretaker,
};
