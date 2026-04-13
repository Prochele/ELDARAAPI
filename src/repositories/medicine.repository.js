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
    createdBy,
    fileId
  } = data;
try {
  const [rows] = await db.query(
    `CALL USP_InsertMedicineSchedule(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      createdBy,
      fileId
    ]
  );

  return rows;
  } catch (err) {
  console.error('DB ERROR...........:', err);
  throw err;
}
};

const logMedicineStatus = async (data) => {
  const { scheduleId, status, userId, notes } = data;

  const [rows] = await db.query(
    `CALL sp_log_medicine_status(?,?,?,?)`,
    [scheduleId, status, userId, notes]
  );

  return rows;
};

module.exports = {
  addMedicineSchedule,
  logMedicineStatus
};