const patronRepository = require('../repositories/patron.repository');

const createPatron = async (data) => {

  const result = await patronRepository.createPatron(data);

  // Do NOT throw error for business validation
  return result;

};

const getPatronList = async (userId, roleCode) => {

  const patrons = await patronRepository.getPatronList(userId, roleCode);

  return patrons;

};

/* ================= GET PATRON DETAILS ================= */

const getPatronDetails = async (ptaUserId, patronId) => {

  const patron = await patronRepository.getPatronDetails(ptaUserId, patronId);

  return patron;
};

/* ================= DELETE PATRON ================= */

const deletePatron = async (ptaUserId, patronId) => {

  const result = await patronRepository.deletePatron(ptaUserId, patronId);

  return result;
};

/* ================= CHECK PATRON LIMIT ================= */

const checkPatronLimit = async (ptaUserId) => {

  const result = await patronRepository.checkPatronLimit(ptaUserId);

  return result;
};

module.exports = {
  createPatron,
  getPatronList,
  getPatronDetails,
  deletePatron,
  checkPatronLimit
};
