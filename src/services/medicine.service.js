// src/services/medicine.service.js

const medicineRepository = require('../repositories/medicine.repository');

const addMedicineSchedule = async (body) => {
  if (typeof body !== 'object') {
    throw new Error('Invalid request body');
  }

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
  } = body;

  // 🔹 Validation
  if (!patronId) throw new Error('patronId is required');
  if (!medicineName) throw new Error('medicineName is required');
  if (!medicineTypeId) throw new Error('medicineTypeId is required');
  if (!fromDate || !toDate) throw new Error('fromDate and toDate required');
  if (!intakeTypeId) throw new Error('intakeTypeId is required');
  if (!dosage) throw new Error('dosage is required');
  if (!selectedDays || selectedDays.length === 0) throw new Error('selectedDays required');
  if (!scheduleTypeIds || scheduleTypeIds.length === 0) throw new Error('scheduleTypeIds required');
  if (!createdBy) throw new Error('createdBy is required');

  return await medicineRepository.addMedicineSchedule({
    patronId,
    medicineName,
    medicineTypeId,
    fromDate,
    toDate,
    intakeTypeId,
    dosage,
    selectedDays,
    scheduleTypeIds,
    needAlarm: needAlarm || 0,
    ocrRawJson: ocrRawJson || null,
    createdBy
  });
};
console.log('Medicine service loaded:........');
module.exports = {
  addMedicineSchedule,
};