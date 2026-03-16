const db = require('../config/db');

const createPatron = async (data) => {
  const {
    ptaUserId,
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
    areaId
  } = data;

  const query = `
    CALL sp_create_patron(
      ?,?,?,?,?,?,
      ?,?,?,?,?,?
    )
  `;

  const params = [
    ptaUserId,
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
    areaId
  ];

  const [rows] = await db.query(query, params);

  return rows[0][0];
};

const getPatronList = async (ptaUserId) => {

  const sql = `CALL sp_get_patron_list(?)`;

  const [rows] = await db.query(sql, [ptaUserId]);

  return rows[0];

};

/* ================= DELETE PATRON ================= */

const deletePatron = async (ptaUserId, patronId) => {

  const [rows] = await db.query(
    `CALL sp_delete_patron(?, ?)`,
    [ptaUserId, patronId]
  );

  return rows[0][0];
};

/* ================= GET PATRON DETAILS ================= */

const getPatronDetails = async (ptaUserId, patronId) => {

  const [rows] = await db.query(
    `CALL sp_get_patron_details(?, ?)`,
    [ptaUserId, patronId]
  );

  return rows[0][0];
};

/* ================= CHECK PATRON LIMIT ================= */

const checkPatronLimit = async (ptaUserId) => {

  const [rows] = await db.query(
    `CALL sp_check_patron_limit(?)`,
    [ptaUserId]
  );

  return rows[0][0];
};

module.exports = {
  createPatron,
  getPatronList,
  getPatronDetails,
  deletePatron,
  checkPatronLimit
};