const test = require('node:test');
const assert = require('node:assert/strict');
const { windowFor, checkIn, request } = require('../src/utils/wellness');
const clock = new Date('2026-11-23T18:29:59.999Z');
const valid = { date: '2026-11-23', feeling: 'well', sleepMinutes: 420, sleepQuality: 'rested', mood: 'calm', painLevel: 0, painLocation: '', notes: '' };
test('Wellness retention switches at Indian midnight, not UTC midnight', () => {
  assert.equal(windowFor(clock).oldestDate, '2026-11-17');
  const next = windowFor(new Date('2026-11-23T18:30:00.000Z'));
  assert.equal(next.today, '2026-11-24'); assert.equal(next.oldestDate, '2026-11-18');
  assert.equal(next.resolvedCutoff, '2026-11-16 18:30:00.000');
});
test('daily answers reject impossible dates, future/expired days, coercion and identity injection', () => {
  const w = windowFor(clock);
  for (const patch of [{ date: '2026-02-30' }, { date: '2026-11-16' }, { date: '2026-11-24' },
    { painLevel: '3' }, { painLevel: 11 }, { sleepMinutes: 1441 }, { notes: 'a'.repeat(1001) },
    { enteredById: 999 }, { patronId: 999 }, { feeling: 'diagnosis' }])
    assert.throws(() => checkIn({ ...valid, ...patch }, w), e => e.status === 400);
  assert.equal(checkIn({ ...valid, painLocation: 'old text' }, w).painLocation, '');
  assert.equal(checkIn({ ...valid, sleepMinutes: null }, w).sleepMinutes, null);
  const { date, ...fields } = valid;
  assert.throws(() => checkIn({ ...fields, date, version: 1 }, w, true));
});
test('assistance is a bounded manual request; notification options are not accepted', () => {
  assert.deepEqual(request({ category: 'transport', description: 'Help arranging transport' }), { category: 'transport', description: 'Help arranging transport' });
  assert.throws(() => request({ category: 'transport', description: 'Help', notify: true }));
  assert.throws(() => request({ category: 'other', description: '' }));
});
