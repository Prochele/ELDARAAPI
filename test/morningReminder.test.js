const test = require('node:test');
const assert = require('node:assert/strict');
const { getIndiaClock, formatReminderTime, buildReminder } = require('../src/utils/morningReminder.util');
const { createMorningReminderRunner } = require('../src/services/morningReminder.service');
const { buildScheduleMessage } = require('../src/utils/schedulePush.util');

const now = new Date('2026-10-27T02:30:00Z');
const appointment = { ReminderType: 'DOCTOR_APPOINTMENT', SourceID: 12, RecipientID: 47,
  ScheduleDate: '2026-10-27', EventTime: '10:30:00', Description: 'Dr. Kumar' };
const activity = { ...appointment, ReminderType: 'DAILY_ACTIVITY', SourceID: 13,
  EventTime: '18:00:00', Description: 'Go to wedding' };
const device = { DeviceUUID: 'test-device', Platform: 'ANDROID', PushToken: 'test-token' };

test('08:00 uses India time independently of the host timezone and calendar midnight', () => {
  assert.deepEqual(getIndiaClock(now), { date: '2026-10-27', time: '08:00:00', afterMorning: true });
  assert.equal(getIndiaClock(new Date('2026-10-27T02:29:59Z')).afterMorning, false);
  assert.equal(getIndiaClock(new Date('2026-10-26T18:30:00Z')).date, '2026-10-27');
});

test('AM/PM formatting handles midnight, noon and afternoon without ambiguous dates', () => {
  for (const [input, output] of [['00:00:00', '12:00 AM'], ['12:00:00', '12:00 PM'],
    ['10:30:00', '10:30 AM'], ['18:00:00', '6:00 PM'], ['23:59:00', '11:59 PM']]) {
    assert.equal(formatReminderTime(input), output);
  }
  assert.throws(() => formatReminderTime('25:70:00'));
});

test('example messages use the assigned person and do not repeat the doctor prefix', () => {
  const doctor = buildReminder(appointment, now);
  assert.equal(doctor.body, "Doctor's appointment today with Dr. Kumar at 10:30 AM");
  assert.equal(doctor.recipientId, '47');
  assert.equal(buildReminder(activity, now).body, 'Go to wedding today at 6:00 PM');
  assert.equal(doctor.id, buildReminder(appointment, now).id);
});

test('before 8am, wrong dates and already-past events do not send a stale today alert', () => {
  assert.equal(buildReminder(appointment, new Date('2026-10-27T02:29:59Z')), null);
  assert.equal(buildReminder({ ...appointment, ScheduleDate: '2026-10-28' }, now), null);
  assert.equal(buildReminder({ ...appointment, EventTime: '07:00:00' }, now), null);
  assert.equal(buildReminder(appointment, new Date('2026-10-27T05:01:01Z')), null);
});

test('an event at 8am is still eligible when the cron callback starts seconds into the minute', () => {
  const event = { ...appointment, EventTime: '08:00:00' };
  assert.ok(buildReminder(event, new Date('2026-10-27T02:30:05Z')));
  assert.equal(buildReminder(event, new Date('2026-10-27T02:31:00Z')), null);
});

const harness = (overrides = {}) => {
  const calls = [];
  const claims = new Set();
  const repository = {
    findEvents: async (date, time) => { calls.push(['events', date, time]); return [appointment, activity]; },
    findDevices: async id => { calls.push(['devices', id]); return [device]; },
    claim: async (event, target) => {
      const key = `${event.SourceID}-${target.DeviceUUID}`;
      if (claims.has(key)) return null;
      claims.add(key);
      return key;
    },
    complete: async claim => calls.push(['complete', claim]),
    fail: async (...args) => calls.push(['fail', ...args]),
    ...overrides,
  };
  const send = async (target, reminder) => calls.push(['send', target, reminder]);
  const logger = { error: (...args) => calls.push(['error', ...args]), warn: () => {} };
  return { calls, repository, send, logger };
};

test('morning run sends both events only to assigned devices and repeated ticks do not resend', async () => {
  const h = harness();
  const run = createMorningReminderRunner({ ...h, clock: () => now });
  await run();
  await run();
  assert.equal(h.calls.filter(call => call[0] === 'send').length, 2);
  assert.ok(h.calls.filter(call => call[0] === 'devices').every(call => call[1] === 47));
  assert.equal(h.calls.filter(call => call[0] === 'complete').length, 2);
});

test('no events or devices produces no sends, and duplicate push tokens send once per event', async () => {
  for (const overrides of [{ findEvents: async () => [] }, { findDevices: async () => [] }]) {
    const h = harness(overrides);
    await createMorningReminderRunner({ ...h, clock: () => now })();
    assert.equal(h.calls.filter(call => call[0] === 'send').length, 0);
  }
  const h = harness({ findDevices: async () => [device, { ...device, DeviceUUID: 'duplicate' }] });
  await createMorningReminderRunner({ ...h, clock: () => now })();
  assert.equal(h.calls.filter(call => call[0] === 'send').length, 2);
});

test('delivery failures are not marked sent and invalid tokens are permanent failures', async () => {
  for (const code of ['messaging/registration-token-not-registered', 'messaging/server-unavailable']) {
    const h = harness();
    h.send = async () => { throw Object.assign(new Error('test failure'), { code }); };
    await createMorningReminderRunner({ ...h, clock: () => now })();
    assert.equal(h.calls.filter(call => call[0] === 'complete').length, 0);
    const failures = h.calls.filter(call => call[0] === 'fail');
    assert.equal(failures.length, 2);
    assert.equal(failures[0][3], code === 'messaging/registration-token-not-registered');
  }
});

test('one runner never overlaps itself and can recover after a database error', async () => {
  let release;
  let queries = 0;
  const h = harness({ findEvents: () => { queries++; return new Promise(resolve => { release = resolve; }); } });
  const run = createMorningReminderRunner({ ...h, clock: () => now });
  const first = run();
  await run();
  assert.equal(queries, 1);
  release([]);
  await first;
  h.repository.findEvents = async () => { throw Object.assign(new Error('db'), { code: 'test-db' }); };
  await run();
  h.repository.findEvents = async () => [activity];
  await run();
  assert.equal(h.calls.filter(call => call[0] === 'send').length, 1);
});

test('Android is data-only for one Notifee display, with expiry and no medicine channel', () => {
  const reminder = buildReminder(activity, now);
  const message = buildScheduleMessage(device, reminder, now.getTime());
  assert.equal(message.notification, undefined);
  assert.equal(message.android.priority, 'high');
  assert.equal(message.android.ttl, reminder.expiresAt - now.getTime());
  assert.equal(message.data.type, 'DAILY_ACTIVITY');
  assert.equal(message.apns, undefined);
});

test('iPhone uses an APNs alert, sound, stable grouping, expiry and bounded collapse ID', () => {
  const message = buildScheduleMessage({ ...device, Platform: 'IOS' }, buildReminder(appointment, now));
  assert.equal(message.android, undefined);
  assert.equal(message.apns.payload.aps.alert.body, "Doctor's appointment today with Dr. Kumar at 10:30 AM");
  assert.equal(message.apns.payload.aps.threadId, 'eldara-schedule-47-2026-10-27');
  assert.equal(message.apns.headers['apns-collapse-id'].length, 64);
  assert.equal(message.apns.headers['apns-push-type'], 'alert');
  assert.equal(message.apns.payload.aps.sound, 'default');
});

test('long Unicode activity descriptions produce a bounded push preview without changing the stored text', () => {
  const description = '\u{1F600}'.repeat(500);
  const event = { ...activity, Description: description };
  const message = buildScheduleMessage({ ...device, Platform: 'IOS' }, buildReminder(event, now));
  assert.ok(Buffer.byteLength(JSON.stringify(message), 'utf8') < 4096);
  assert.match(message.data.body, /\.\.\. today at 6:00 PM$/);
  assert.equal(event.Description, description);
});
