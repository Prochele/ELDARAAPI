const Joi = require('joi');
const { fail, number, date, indiaDate } = require('./careWorkflow');
const adminRoles = ['PTA', 'PTASelf', 'PTAFamily'];
const roles = [...adminRoles, 'PT', 'CT'];
const utcSql = (now) => new Date(now).toISOString().replace('T', ' ').replace('Z', '');
const windowFor = (now) => {
  const today = indiaDate(new Date(now).getTime());
  return {
    today,
    oldestDate: new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10),
    resolvedCutoff: utcSql(new Date(now).getTime() - 7 * 86400000),
    now: utcSql(now),
  };
};
const fields = {
  feeling: Joi.string().valid('well', 'okay', 'unwell').required(),
  sleepMinutes: Joi.number().integer().min(0).max(1440).allow(null).required(),
  sleepQuality: Joi.string().valid('rested', 'fair', 'poor', 'not-recorded').required(),
  mood: Joi.string().valid('happy', 'calm', 'low', 'worried').required(),
  painLevel: Joi.number().integer().min(0).max(10).required(),
  painLocation: Joi.string().trim().max(160).allow('').required(),
  notes: Joi.string().trim().max(1000).allow('').required(),
};
const validate = (schema, input) => {
  const result = schema.validate(input, { abortEarly: true, convert: false });
  if (result.error) fail(result.error.details[0].message);
  return result.value;
};
const checkIn = (input, window, updating = false) => {
  const value = validate(Joi.object({
    ...fields,
    ...(updating ? { version: Joi.number().integer().min(1).required() } : { date: Joi.string().required() }),
  }).required(), input);
  if (!updating) {
    date(value.date);
    if (value.date < window.oldestDate || value.date > window.today)
      fail('Choose today or one of the previous six days.');
  }
  if (value.painLevel === 0) value.painLocation = '';
  return value;
};
const request = (input) => validate(Joi.object({
  category: Joi.string().valid('daily-support', 'transport', 'appointment', 'other').required(),
  description: Joi.string().trim().min(1).max(1000).required(),
}).required(), input);
const requestUpdate = (input) => validate(Joi.object({
  state: Joi.string().valid('acknowledged', 'resolved').required(),
  version: Joi.number().integer().min(1).required(),
}).required(), input);
const version = (input) => validate(Joi.object({ version: Joi.number().integer().min(1).required() }).required(), input).version;
module.exports = { fail, number, adminRoles, roles, utcSql, windowFor, checkIn, request, requestUpdate, version };
