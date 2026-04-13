const db = require('../config/db');

const getMedicineSchedule = async (patronId) => {

  const [rows] = await db.query(
    'CALL USP_GetMedicineSchedule(?)',
    [patronId]
  );

  return rows[0];
};

const deleteMedicine = async (medicineId, userId) => {

  const [rows] = await db.query(
    'CALL USP_DeleteMedicine(?)',
    [medicineId]
  );

  return rows;
};

module.exports = {
  getMedicineSchedule,
  deleteMedicine
};