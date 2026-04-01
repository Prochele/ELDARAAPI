// src/repositories/master.repository.js

const db = require('../config/db');

const getMedicineTypes = async () => {
  const [rows] = await db.query('CALL USP_GetMedicineTypes()');
  return rows[0];
};

const getMedicineSchedulesTypes = async () => {
  const [rows] = await db.query('CALL USP_GetMedicineSchedulesTypes()');
  return rows[0];
};

const getIntakeTypes = async () => {
  const [rows] = await db.query('CALL USP_GetIntakeTypes()');
  return rows[0];
};

module.exports = {
  getMedicineTypes,
  getMedicineSchedulesTypes,
  getIntakeTypes,
};