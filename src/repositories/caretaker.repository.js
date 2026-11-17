const db = require('../config/db');

const getRegisteredCaretakers = async (searchCode = '') => {
  // Preserve the old response shape without the SP's phone/email search side channel.
  const search=String(searchCode||'').slice(0,100);
  const [rows]=await db.query(`SELECT U.UserID caretakerId,CONCAT_WS(' ',U.FirstName,U.LastName) caretakerName,
    CONCAT('CT',LPAD(U.UserID,6,'0')) caretakerCode,U.GenderID genderId,
    TIMESTAMPDIFF(YEAR,U.DOB,CURDATE()) age,
    (SELECT AVG(Rating) FROM CaretakerRating WHERE CaretakerId=U.UserID) averageRating,
    (SELECT COUNT(*) FROM CaretakerRating WHERE CaretakerId=U.UserID) ratingCount
    FROM UserMaster U WHERE U.StatusID=1 AND EXISTS(SELECT 1 FROM UserRoleMapping M
      JOIN RoleMaster R ON R.RoleID=M.RoleID WHERE M.UserID=U.UserID AND M.IsActive=1 AND R.RoleCode='CT')
    AND (?='' OR CONCAT_WS(' ',U.FirstName,U.LastName) LIKE ? OR CONCAT('CT',LPAD(U.UserID,6,'0')) LIKE ?)
    ORDER BY U.FirstName,U.UserID LIMIT 200`,[search,'%'+search+'%','%'+search+'%']);
  return rows;
};

const getAssignedCaretakers = async (ptaUserId, patronId) => {
  const [rows] = await db.query(`CALL sp_get_assigned_caretakers(?, ?)`, [ptaUserId, patronId]);
  return (rows[0] || []).map(({mobileNumber,emailId,...profile})=>profile);
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
