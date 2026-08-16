const db = require('../config/db');
const { DB_HOST } = require('../config/env');

const findExistingUserByMobileOrEmail = async (mobileNumber, emailId) => {
  const [rows] = await db.query(
    `
    SELECT
      MobileNumber,
      EmailID
    FROM UserMaster
    WHERE MobileNumber = ?
       OR EmailID = ?
    LIMIT 1
    `,
    [mobileNumber, emailId]
  );

  return rows[0] || null;
};

const callSignupProcedure = async (payload) => {
  const {
    firstName,
    lastName,
    mobileNumber,
    emailId,
    genderId,
    dob,
    countryId,
    provinceId,
    districtId,
    cityId,
    areaId,
    planId,
    createdBy,
  } = payload;

  const [rows] = await db.query(
    `CALL sp_user_signup(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      firstName,
      lastName,
      mobileNumber,
      emailId,
      genderId,
      dob,
      countryId,
      provinceId,
      districtId,
      cityId,
      areaId,
      planId,
      createdBy,
    ]
  );

  return rows[0][0]; // Stored procedure result
};

module.exports = {
  callSignupProcedure,
  findExistingUserByMobileOrEmail,
};
