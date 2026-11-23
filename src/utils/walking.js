const Joi = require('joi');
const { fail, date } = require('./careWorkflow');
const { windowFor } = require('./wellness');
const roles = ['PT', 'PTA', 'PTASelf', 'PTAFamily'];
const validate = (schema, input) => {
  const result = schema.required().validate(input, { convert: false });
  if (result.error) fail(result.error.details[0].message);
  return result.value;
};
const window = now => {
  const w = windowFor(now), weekday = new Date(`${w.today}T00:00:00Z`).getUTCDay();
  const weekStart = new Date(Date.parse(`${w.today}T00:00:00Z`) - ((weekday + 6) % 7) * 86400000).toISOString().slice(0,10);
  return { ...w, weekStart };
};
const day = (value, w) => {
  date(value);
  if (value < w.oldestDate || value > w.today) fail('Choose today or one of the previous six days.');
  return value;
};
const goal = body => validate(Joi.object({
  dailySteps: Joi.number().integer().min(100).max(100000).allow(null).required(),
  weeklySteps: Joi.number().integer().min(100).max(700000).allow(null).required(),
  strideCm: Joi.number().integer().min(20).max(150).required(),
  version: Joi.number().integer().min(0).required(),
}), body);
const walk = (body, w) => {
  const b = validate(Joi.object({
    clientId: Joi.string().guid({ version: 'uuidv4' }).required(),
    date: Joi.string().required(),
    steps: Joi.number().integer().min(0).max(200000).required(),
    distanceMeters: Joi.number().integer().min(0).max(200000).allow(null).required(),
    activeSeconds: Joi.number().integer().min(0).max(86400).required(),
    source: Joi.string().valid('manual', 'sensor').required(),
    distanceSource: Joi.string().valid('device-estimate', 'step-estimate', 'manual', 'unavailable').required(),
  }), body);
  day(b.date, w);
  if (!b.steps && !b.activeSeconds && !b.distanceMeters) fail('Enter some walking activity before saving.');
  if ((b.distanceMeters === null) !== (b.distanceSource === 'unavailable')) fail('Choose a valid distance source.');
  if (b.source === 'manual' && !['manual', 'unavailable'].includes(b.distanceSource)) fail('Manual walks must be labelled as manual.');
  if (b.source === 'sensor' && b.distanceSource === 'manual') fail('Sensor walks must use a device or step estimate.');
  return b;
};
module.exports = { roles, window, day, goal, walk };
