// src/repositories/medicine.repository.js

const db = require('../config/db');

const addMedicineSchedule = async (data) => {
  const {
    patronId,
    medicineName,
    medicineTypeId,
    fromDate,
    toDate,
    intakeTypeId,
    dosage,
    selectedDays,
    scheduleTypeIds,
    needAlarm,
    ocrRawJson,
    createdBy
  } = data;
try {
  const [rows] = await db.query(
    `CALL USP_InsertMedicineSchedule(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      patronId,
      medicineName,
      medicineTypeId,
      fromDate,
      toDate,
      intakeTypeId,
      dosage,
      JSON.stringify(selectedDays),
      JSON.stringify(scheduleTypeIds),
      needAlarm,
      ocrRawJson ? JSON.stringify(ocrRawJson) : null,
      createdBy
    ]
  );

  return rows;
  } catch (err) {
  console.error('DB ERROR...........:', err);
  throw err;
}
};

module.exports = {
  addMedicineSchedule,
};