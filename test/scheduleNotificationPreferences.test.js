const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const deviceRepository = require('../src/repositories/device.repository');
const service = require('../src/services/device.service');
const controller = require('../src/controllers/device.controller');

test('schedule preference updates reject missing/non-boolean switches before any database access', async () => {
  for (const body of [{}, { appointmentRemindersEnabled: 'false', activityRemindersEnabled: true },
    { appointmentRemindersEnabled: true }]) {
    await assert.rejects(service.updateScheduleReminderNotifications(47, body), /must be boolean/);
  }
});

test('device registration uses the authenticated user/session, not a caller-supplied identity', async () => {
  const original = service.saveDeviceToken;
  let saved;
  service.saveDeviceToken = async payload => { saved = payload; return { userId: payload.userId }; };
  try {
    let result;
    const res = { status: () => res, json: value => { result = value; } };
    await controller.saveDeviceToken({
      user: { UserID: 47 }, headers: { authorization: 'Bearer trusted-session' },
      body: { userId: 99, sessionToken: 'untrusted-session', deviceUUID: 'qa-phone',
        pushToken: 'test-token', supportsScheduleReminders: true },
    }, res, error => { throw error; });
    assert.equal(saved.userId, 47);
    assert.equal(saved.sessionToken, 'trusted-session');
    assert.equal(result.data.userId, 47);
  } finally { service.saveDeviceToken = original; }
});

test('before migration, missing schedule tables do not break existing medicine token registration', async () => {
  const originalSave = deviceRepository.saveDeviceToken;
  const originalQuery = db.query;
  let medicineRegistration = false;
  deviceRepository.saveDeviceToken = async () => { medicineRegistration = true; };
  db.query = async () => { throw Object.assign(new Error('Missing new table'), { code: 'ER_NO_SUCH_TABLE' }); };
  try {
    const result = await service.saveDeviceToken({ userId: 47, deviceUUID: 'qa-phone',
      pushToken: 'test-token', sessionToken: 'test-session', supportsScheduleReminders: true });
    assert.equal(medicineRegistration, true);
    assert.deepEqual(result, { userId: 47, scheduleRemindersRegistered: false });
  } finally {
    deviceRepository.saveDeviceToken = originalSave;
    db.query = originalQuery;
  }
});
