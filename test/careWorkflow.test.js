const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/utils/careWorkflow');
const a = {
  kind: 'weekly',
  fromDate: '2026-11-17',
  toDate: null,
  weekdays: [1, 2, 3, 4, 5],
  fromMinute: 540,
  toMinute: 780,
};
test('care scheduling compares date, weekday and hours together', () => {
  assert.equal(v.overlaps(a, { ...a, fromMinute: 780, toMinute: 900 }), false);
  assert.equal(v.overlaps(a, { ...a, fromMinute: 779, toMinute: 900 }), true);
  assert.equal(v.overlaps(a, { ...a, weekdays: [0, 6] }), false);
  assert.equal(v.overlaps({ ...a, toDate: '2026-11-20' }, { ...a, fromDate: '2026-11-21' }), false);
  assert.equal(
    v.overlaps({ ...a, fromDate: '2026-11-20', toDate: '2026-11-22', weekdays: [1] }, a),
    false
  );
  assert.equal(v.overlaps(a, { ...a, kind: 'legacy' }), true);
});
test('leave and weekly ranges enforce the exact occurrences', () => {
  const slots = a.weekdays.map((weekday) => ({ weekday, fromMinute: 480, toMinute: 900 }));
  assert.equal(v.fitsAvailability(a, slots, []), true);
  assert.equal(
    v.fitsAvailability(a, slots, [{ fromDate: '2026-11-21', toDate: '2026-11-22' }]),
    true
  );
  assert.equal(
    v.fitsAvailability(a, slots, [{ fromDate: '2026-11-20', toDate: '2026-11-22' }]),
    false
  );
  assert.equal(v.fitsAvailability(a, slots.slice(1), []), false);
  assert.deepEqual(
    v.freeSlots([{ weekday: 1, fromMinute: 480, toMinute: 1200 }], [a], '2026-11-17'),
    [
      { weekday: 1, fromMinute: 480, toMinute: 540 },
      { weekday: 1, fromMinute: 780, toMinute: 1200 },
    ]
  );
});
test('invalid dates, overnight and overlapping availability are rejected', () => {
  for (const date of ['17-11-2026', '2026-02-30', '2026-13-01']) assert.throws(() => v.date(date));
  assert.throws(() => v.normalizeSlots([{ weekday: 1, from: '22:00', to: '06:00' }]));
  assert.throws(() =>
    v.normalizeSlots([
      { weekday: 1, from: '09:00', to: '12:00' },
      { weekday: 1, from: '11:00', to: '13:00' },
    ])
  );
  assert.equal(v.indiaDate(Date.parse('2026-11-16T20:00:00Z')), '2026-11-17');
});
