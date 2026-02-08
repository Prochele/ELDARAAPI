const Joi = require('joi');
const messages = require('./messages');

const authenticateSchema = Joi.object({
  identifier: Joi.string().trim().required()
    .messages({ 'any.required': messages.VALIDATION.IDENTIFIER_REQUIRED }),

  otp: Joi.string().length(6).required()
    .messages({ 'any.required': messages.VALIDATION.OTP_REQUIRED }),

  roleId: Joi.number().integer().required()
    .messages({ 'any.required': messages.VALIDATION.ROLE_REQUIRED }),

  deviceUUID: Joi.string().required()
    .messages({ 'any.required': messages.VALIDATION.DEVICE_REQUIRED }),

  platform: Joi.string().required()
    .messages({ 'any.required': messages.VALIDATION.PLATFORM_REQUIRED }),

  appVersion: Joi.string().required()
    .messages({ 'any.required': messages.VALIDATION.VERSION_REQUIRED }),
});

module.exports = {
  authenticateSchema,
};
