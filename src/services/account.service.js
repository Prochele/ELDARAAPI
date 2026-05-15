const accountRepository = require('../repositories/account.repository');

const getProfile = async (userId) => {
  return accountRepository.getProfile(userId);
};

const updateEmail = async (userId, emailId) => {
  return accountRepository.updateEmail(userId, emailId);
};

const updatePhone = async (userId, mobileNumber) => {
  return accountRepository.updatePhone(userId, mobileNumber);
};

const removeAccount = async (userId) => {
  return accountRepository.removeAccount(userId);
};

module.exports = {
  getProfile,
  updateEmail,
  updatePhone,
  removeAccount,
};
