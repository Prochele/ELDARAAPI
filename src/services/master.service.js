// src/services/master.service.js

const masterRepository = require('../repositories/master.repository');

const getMedicineTypes = async () => {
  return await masterRepository.getMedicineTypes();
};

const getMedicineSchedulesTypes = async () => {
  return await masterRepository.getMedicineSchedulesTypes();
};

const getIntakeTypes = async () => {
  return await masterRepository.getIntakeTypes();
};

module.exports = {
  getMedicineTypes,
  getMedicineSchedulesTypes,
  getIntakeTypes,
};