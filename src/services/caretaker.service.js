const caretakerRepository = require('../repositories/caretaker.repository');

const getRegisteredCaretakers = async (searchCode) => {
  return caretakerRepository.getRegisteredCaretakers(searchCode);
};

const getAssignedCaretakers = async (ptaUserId, patronId) => {
  if (!patronId) throw new Error('patronId is required');
  return caretakerRepository.getAssignedCaretakers(ptaUserId, patronId);
};

const assignCaretaker = async (data) => {
  if (!data.patronId) throw new Error('patronId is required');
  if (!data.caretakerCode) throw new Error('caretakerCode is required');

  return caretakerRepository.assignCaretaker(data);
};

const rateCaretaker = async (data) => {
  if (!data.patronId) throw new Error('patronId is required');
  if (!data.caretakerId) throw new Error('caretakerId is required');
  if (!data.rating || data.rating < 1 || data.rating > 5) {
    throw new Error('rating must be between 1 and 5');
  }

  return caretakerRepository.rateCaretaker(data);
};

module.exports = {
  getRegisteredCaretakers,
  getAssignedCaretakers,
  assignCaretaker,
  rateCaretaker,
};
