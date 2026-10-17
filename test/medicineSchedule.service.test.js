const test = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/medicineSchedule.repository');
const service = require('../src/services/medicineSchedule.service');

test('medicine dates preserve day/month order from the procedure through the API', async () => {
  const original = repository.getMedicineSchedule;
  repository.getMedicineSchedule = async () => [
    { FromDate: '11-10-2026', ToDate: '31-10-2026', ScheduleDate: '14-10-2026' },
    { FromDate: '05-06-2026', ToDate: '12-06-2026' },
    { FromDate: '2026-10-11', ToDate: '2026-10-31T00:00:00.000Z' },
    { FromDate: null, ToDate: null },
  ];
  try {
    const rows = await service.getMedicineSchedule(47);
    assert.equal(rows[0].FromDate, '2026-10-11');
    assert.equal(rows[0].ToDate, '2026-10-31');
    assert.equal(rows[0].ScheduleDate, '14-10-2026');
    assert.equal(rows[1].FromDate, '2026-06-05');
    assert.equal(rows[1].ToDate, '2026-06-12');
    assert.equal(rows[2].FromDate, '2026-10-11');
    assert.equal(rows[2].ToDate, '2026-10-31');
    assert.equal(rows[3].FromDate, null);
    assert.equal(rows[3].ToDate, null);
  } finally {
    repository.getMedicineSchedule = original;
  }
});

test('ambiguous medicine dates stay day-first in every month', async () => {
  const original = repository.getMedicineSchedule;
  const rows = [];
  for (let month = 1; month <= 12; month++) {
    for (const day of [1, 5, 11, 12, 28]) {
      rows.push({
        FromDate: `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-2026`,
        ToDate: `28-${String(month).padStart(2, '0')}-2026`,
      });
    }
  }
  repository.getMedicineSchedule = async () => rows;
  try {
    const result = await service.getMedicineSchedule(47);
    result.forEach((row, index) => {
      const [day, month, year] = rows[index].FromDate.split('-');
      assert.equal(row.FromDate, `${year}-${month}-${day}`);
      assert.equal(row.ToDate, `${year}-${month}-28`);
    });
  } finally {
    repository.getMedicineSchedule = original;
  }
});

test('database DATE fields remain calendar strings while timestamps retain their driver handling', () => {
  const db = require('../src/config/db');
  assert.deepEqual(db.pool.config.connectionConfig.dateStrings, ['DATE']);
});
