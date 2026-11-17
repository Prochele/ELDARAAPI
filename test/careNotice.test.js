const test = require('node:test'),
  assert = require('node:assert/strict');
const { createCareNoticeWorker } = require('../src/services/careNotice.service');
test('care outbox skips old apps, uses bound sessions and persists successful deliveries', async () => {
  const calls = [],
    sent = [];
  const notice = { ID: 1, RecipientID: 104, Target: 'inbox', ReferenceID: 7 };
  const query = async (sql, params) => {
    calls.push([sql, params]);
    if (sql.includes('FOR UPDATE SKIP LOCKED')) return [[notice]];
    if (sql.includes('SELECT DISTINCT D.PushToken'))
      return [
        [
          { PushToken: 'old', Platform: 'ANDROID', AppVersion: '1.9.6' },
          { PushToken: 'current', Platform: 'ANDROID', AppVersion: '1.9.7' },
        ],
      ];
    return [{}];
  };
  const pool = {
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
    }),
  };
  await createCareNoticeWorker(pool, async (device, n) =>
    sent.push([device.PushToken, n.RecipientID])
  )();
  assert.deepEqual(sent, [['current', 104]]);
  assert.ok(calls.some(([sql]) => sql.includes('SET SentAt=')));
  const deviceSql = calls.find(([sql]) => sql.includes('SELECT DISTINCT D.PushToken'))[0];
  for (const part of ['R.SessionTokenHash', 'R.PushTokenHash', 'T.IsActive=1', 'D.UserID=?'])
    assert.ok(deviceSql.includes(part));
});
test('failed care push remains retryable and no overlapping worker runs', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  let runs = 0,
    marked = false;
  const query = async (sql) => {
    if (sql.includes('FOR UPDATE SKIP LOCKED')) {
      runs++;
      await gate;
      return [[{ ID: 1, RecipientID: 104 }]];
    }
    if (sql.includes('SELECT DISTINCT')) return [[{ AppVersion: '1.9.7' }]];
    if (sql.includes('SET SentAt=')) marked = true;
    return [{}];
  };
  const worker = createCareNoticeWorker(
    {
      query,
      getConnection: async () => ({
        query,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release() {},
      }),
    },
    async () => {
      throw Object.assign(Error('offline'), { code: 'test/offline' });
    }
  );
  const one = worker();
  await worker();
  release();
  await one;
  assert.equal(runs, 1);
  assert.equal(marked, false);
});
