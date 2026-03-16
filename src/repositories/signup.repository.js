const db = require('../config/db');
const { DB_HOST } = require('../config/env');

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
};