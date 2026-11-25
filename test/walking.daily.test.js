const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const v = require('../src/utils/walking');
const { createWalkingService } = require('../src/services/walking.service');
const { createWalkingRouter } = require('../src/routes/walking.routes');

const clock = () => new Date('2026-11-25T12:00:00Z');
const user = { UserID: 11, RoleCode: 'PT' };
const snapshot = (extra = {}) => ({ date: '2026-11-25', steps: 1200, distanceMeters: 780,
  distanceSource: 'step-estimate', ...extra });
const status = expected => e => e.status === expected;

// Record database requests without importing configuration or opening a connection.
function harness({ rows = [], active = true, failAt } = {}) {
  const calls = [];
  const record = (kind, sql, args) => {
    calls.push({ kind, sql, args });
    if (failAt === kind) throw new Error(`failure at ${kind}`);
  };
  const read = async (kind, { sql }, args) => {
    record(kind, sql, args);
    assert.match(sql, /FROM WalkingDailySnapshot WHERE UserID=\? AND SnapshotDate BETWEEN \? AND \?/);
    assert.match(sql, /ORDER BY SnapshotDate DESC/);
    assert.deepEqual(args, [11, '2026-11-19', '2026-11-25']);
    return [rows];
  };
  const db = {
    beginTransaction: async () => record('begin'),
    commit: async () => record('commit'),
    rollback: async () => record('rollback'),
    release: () => record('release'),
    query: async (options, args) => {
      if (options.sql.startsWith('SELECT')) return read('transaction-read', options, args);
      record('upsert', options.sql, args);
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    query: (options, args) => read('read', options, args),
    getConnection: async () => { record('connection'); return db; },
  };
  const accessPool = { query: async ({ sql }, args) => {
    record('owner', sql, args);
    assert.match(sql, /FROM UserMaster WHERE UserID=\? AND StatusID=1/);
    assert.deepEqual(args, [11]);
    return [active ? [{ id: 11, name: 'Personal Owner' }] : []];
  } };
  return { calls, service: createWalkingService({ pool, accessPool, clock }) };
}

test('daily snapshots validate the entire strict batch, allowing zero and both integer limits', () => {
  const w = v.window(clock());
  assert.deepEqual(v.dailySteps({ days: [snapshot({ steps: 0, distanceMeters: 0 })] }, w),
    [snapshot({ steps: 0, distanceMeters: 0 })]);
  const days = Array.from({ length: 7 }, (_, i) => snapshot({ date: `2026-11-${19 + i}`,
    steps: i ? 200000 : 0, distanceMeters: i ? 200000 : 0,
    distanceSource: i % 2 ? 'device-estimate' : 'step-estimate' }));
  assert.deepEqual(v.dailySteps({ days }, w), days);
  const invalidRows = [null, [], {}, ...[
    { steps: -1 }, { steps: 200001 }, { steps: 1.5 }, { steps: '1' }, { steps: true }, { steps: null }, { steps: undefined },
    { distanceMeters: -1 }, { distanceMeters: 200001 }, { distanceMeters: 0.5 },
    { distanceMeters: '780' }, { distanceMeters: null }, { distanceMeters: undefined },
    { distanceSource: 'manual' }, { distanceSource: 'unavailable' }, { distanceSource: undefined },
    { date: undefined }, { date: '2026-11-18' }, { date: '2026-11-26' }, { date: '2026-02-30' }, { date: '2026-11-25T00:00:00Z' },
    { UserID: 12 }, { ownerId: 12 }, { patronId: 12 }, { source: 'sensor' }, { activeSeconds: 60 },
  ].map(extra => snapshot(extra))];
  for (const row of invalidRows) assert.throws(() => v.dailySteps({ days: [row] }, w), status(400));
  for (const body of [null, undefined, [], {}, { days: [] }, { days: null }, { days: 'invalid' },
    { days: [snapshot(), snapshot()] }, { days: [...days, snapshot()] },
    ...['UserID', 'owner', 'ownerId', 'patronId', 'groupId', 'unexpected'].map(key => ({ days, [key]: 12 }))]) {
    assert.throws(() => v.dailySteps(body, w), status(400));
  }
});

test('daily retention rolls exactly at IST midnight and includes six preceding dates', () => {
  const zero = snapshot({ date: '2026-11-18', steps: 0, distanceMeters: 0 });
  const before = v.window(new Date('2026-11-24T18:29:59.999Z'));
  const after = v.window(new Date('2026-11-24T18:30:00.000Z'));
  assert.equal(before.today, '2026-11-24');
  assert.equal(after.today, '2026-11-25');
  assert.equal(v.dailySteps({ days: [zero] }, before)[0].date, '2026-11-18');
  assert.throws(() => v.dailySteps({ days: [zero] }, after), status(400));
  assert.equal(v.dailySteps({ days: [snapshot()] }, after).length, 1);
  assert.throws(() => v.dailySteps({ days: [snapshot()] }, before), status(400));
});

test('daily reads return only snapshots and preserve zero without goals or legacy aggregation', async () => {
  const { service, calls } = harness({ rows: [snapshot({ steps: '0', distanceMeters: '0' })] });
  assert.deepEqual(await service.dailySteps(user), { owner: { id: 11, name: 'Personal Owner' },
    today: '2026-11-25', oldestDate: '2026-11-19', days: [snapshot({ steps: 0, distanceMeters: 0 })] });
  assert.deepEqual(calls.map(c => c.kind), ['owner', 'read']);
  assert.doesNotMatch(calls[1].sql, /WalkingLog|WalkingGoal|SUM\(/i);
  assert.deepEqual((await harness().service.dailySteps(user)).days, []);
});

test('legacy overview still aggregates only walk logs and keeps its existing goals and response fields', async () => {
  const calls = [];
  const pool = { query: async ({ sql }, args) => {
    calls.push(sql);
    assert.doesNotMatch(sql, /WalkingDailySnapshot/);
    if (sql.includes('FROM UserMaster')) return [[{ id: 11, name: 'Personal Owner' }]];
    if (sql.includes('FROM WalkingGoal')) { assert.deepEqual(args, [11]); return [[]]; }
    assert.match(sql, /SUM\(Steps\) steps,SUM\(DistanceMeters\) distanceMeters/);
    assert.match(sql, /FROM WalkingLog WHERE UserID=\? AND WalkDate BETWEEN \? AND \? GROUP BY WalkDate/);
    assert.deepEqual(args, [11, '2026-11-19', '2026-11-25']);
    return [[{ date: '2026-11-25', steps: '2000', distanceMeters: null,
      activeSeconds: '1200', walks: '2', missingDistances: '2' }]];
  } };
  assert.deepEqual(await createWalkingService({ pool, clock }).overview(user), {
    owner: { id: 11, name: 'Personal Owner' }, today: '2026-11-25', oldestDate: '2026-11-19', weekStart: '2026-11-23',
    goals: { dailySteps: null, weeklySteps: null, strideCm: 65, version: 0 },
    days: [{ date: '2026-11-25', steps: 2000, distanceMeters: null, activeSeconds: 1200, walks: 2, missingDistances: 2 }],
  });
  assert.equal(calls.length, 3);
});

test('daily actions require an authenticated active personal owner, including null user handling', async () => {
  for (const action of ['dailySteps', 'putDailySteps']) {
    for (const missing of [null, undefined]) {
      const { service, calls } = harness();
      await assert.rejects(service[action](missing, { days: [snapshot()] }), status(401));
      assert.equal(calls.length, 0);
    }
    for (const RoleCode of ['CT', 'ADMIN', '', undefined]) {
      const { service, calls } = harness();
      await assert.rejects(service[action]({ ...user, RoleCode }, { days: [snapshot()] }), status(403));
      assert.equal(calls.length, 0);
    }
    const inactive = harness({ active: false });
    await assert.rejects(inactive.service[action](user, { days: [snapshot()] }), status(403));
    assert.deepEqual(inactive.calls.map(c => c.kind), ['owner']);
    for (const RoleCode of ['PT', 'PTA', 'PTASelf', 'PTAFamily']) {
      const { service } = harness();
      assert.equal((await service[action]({ ...user, RoleCode }, { days: [snapshot()] })).owner.id, 11);
    }
  }
});

test('invalid later rows cannot open a write transaction or partially save earlier days', async () => {
  for (const last of [snapshot({ date: '2026-11-20', ownerId: 99 }), snapshot({ date: '2026-11-18' }),
    snapshot({ steps: 200001 }), snapshot()]) {
    const { service, calls } = harness();
    await assert.rejects(service.putDailySteps(user, { days: [snapshot(), last] }), status(400));
    assert.deepEqual(calls.map(c => c.kind), ['owner']);
  }
});

test('daily writes use one atomic max upsert and return a complete transactional snapshot', async () => {
  const { service, calls } = harness({ rows: [snapshot(), snapshot({ date: '2026-11-19', steps: 0, distanceMeters: 0 })] });
  const result = await service.putDailySteps(user, { days: [snapshot(), snapshot({ date: '2026-11-19', steps: 0, distanceMeters: 0 })] });
  assert.equal(result.days.length, 2);
  assert.deepEqual(calls.map(c => c.kind), ['owner', 'connection', 'begin', 'upsert', 'transaction-read', 'commit', 'release']);
  const { sql, args } = calls.find(c => c.kind === 'upsert');
  assert.equal((sql.match(/\(\?,\?,\?,\?,\?,\?\)/g) || []).length, 2);
  assert.deepEqual(args, [11, '2026-11-19', 0, 0, 'step-estimate', '2026-11-25 12:00:00.000',
    11, '2026-11-25', 1200, 780, 'step-estimate', '2026-11-25 12:00:00.000']);
  const updates = sql.split('ON DUPLICATE KEY UPDATE')[1].replace(/\s/g, '');
  // MySQL evaluates these assignments left to right. All metadata comparisons must
  // use the old Steps, and strict > must keep both stale values and retries inert.
  for (const field of ['UpdatedAtUTC', 'DistanceMeters', 'DistanceSource']) {
    assert.ok(updates.includes(`${field}=IF(VALUES(Steps)>Steps,VALUES(${field}),${field})`));
    assert.ok(updates.indexOf(`${field}=`) < updates.indexOf('Steps='));
  }
  assert.ok(updates.endsWith('Steps=GREATEST(Steps,VALUES(Steps))'));
  assert.doesNotMatch(sql, /SUM\(|Steps\s*\+|WalkingLog|WalkingGoal/i);
});

test('write or response-read failure rolls back the whole batch and releases its connection', async () => {
  for (const failAt of ['upsert', 'transaction-read', 'commit']) {
    const { service, calls } = harness({ failAt });
    await assert.rejects(service.putDailySteps(user, { days: [snapshot(), snapshot({ date: '2026-11-19' })] }),
      new RegExp(`failure at ${failAt}`));
    assert.deepEqual(calls.slice(-2).map(c => c.kind), ['rollback', 'release']);
    if (failAt !== 'commit') assert.ok(!calls.some(c => c.kind === 'commit'));
  }
});

test('cleanup expires snapshots in bounded batches and finds snapshot-only inactive owners', async () => {
  const calls = [], logExpiry = [500, 2], dailyExpiry = [500, 1], inactiveDaily = [500, 7];
  const pool = { query: async ({ sql }, args) => {
    calls.push({ sql, args });
    if (sql.startsWith('DELETE FROM WalkingLog WHERE WalkDate')) {
      assert.deepEqual(args, ['2026-11-19']); return [{ affectedRows: logExpiry.shift() }];
    }
    if (sql.startsWith('DELETE FROM WalkingDailySnapshot WHERE SnapshotDate')) {
      assert.match(sql, /SnapshotDate<\? LIMIT 500$/);
      assert.deepEqual(args, ['2026-11-19']); return [{ affectedRows: dailyExpiry.shift() }];
    }
    if (sql.startsWith('SELECT UserID id FROM (')) {
      assert.match(sql, /UNION SELECT UserID FROM WalkingDailySnapshot/);
      assert.deepEqual(args, [0]); return [[{ id: 17 }, { id: 18 }]];
    }
    assert.deepEqual(args, [[17]]);
    if (sql.startsWith('DELETE FROM WalkingDailySnapshot WHERE UserID')) {
      assert.match(sql, /LIMIT 500$/); return [{ affectedRows: inactiveDaily.shift() }];
    }
    assert.match(sql, /^DELETE FROM Walking(Log|Goal) WHERE UserID IN \(\?\)$/);
    return [{ affectedRows: 0 }];
  } };
  const accessPool = { query: async ({ sql }, args) => {
    assert.match(sql, /WHERE StatusID=1 AND UserID IN \(\?\)/);
    assert.deepEqual(args, [[17, 18]]); return [[{ id: 18 }]];
  } };
  assert.deepEqual(await createWalkingService({ pool, accessPool, clock }).cleanup(), { removed: 1003 });
  assert.equal(calls.filter(c => /WalkingDailySnapshot WHERE UserID/.test(c.sql)).length, 2);
  assert.equal(logExpiry.length + dailyExpiry.length + inactiveDaily.length, 0);
});

test('daily migration is additive, constrained and identical to the database mirror', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/20261125_walking_daily.sql'), 'utf8');
  assert.equal(sql, fs.readFileSync(path.join(__dirname, '../../ELDARADB/MIGRATIONS/20261125_WALKING_DAILY.sql'), 'utf8'));
  assert.equal((sql.match(/CREATE TABLE/g) || []).length, 1);
  assert.doesNotMatch(sql, /ALTER|DROP|WalkingLog|WalkingGoal|INSERT INTO/i);
  assert.match(sql, /PRIMARY KEY \(UserID,SnapshotDate\)/);
  for (const column of ['Steps', 'DistanceMeters']) {
    assert.match(sql, new RegExp(`${column} INT NOT NULL`));
    assert.match(sql, new RegExp(`CHECK \\(${column} BETWEEN 0 AND 200000\\)`));
  }
  assert.match(sql, /UpdatedAtUTC DATETIME\(3\) NOT NULL/);
  assert.match(sql, /KEY walking_daily_expiry \(SnapshotDate\)/);
  assert.match(sql, /CHECK \(DistanceSource IN \('device-estimate','step-estimate'\)\)/);
});

test('daily router enforces strict input and personal access alongside unchanged legacy routes', async () => {
  const { service } = harness({ rows: [snapshot()] });
  const legacyCalls = [];
  for (const method of ['overview', 'goals', 'create', 'history', 'remove']) {
    service[method] = async (...args) => { legacyCalls.push({ method, args }); return { legacy: method }; };
  }
  const router = createWalkingRouter({ service, authenticate: (req, res, next) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.user = req.headers.authorization === 'null' ? null : { ...user, RoleCode: req.headers.authorization };
    next();
  } });
  // Dispatch through the actual Express router without opening any network socket.
  const request = (url, method = 'GET', body, role = 'PTA') => new Promise((resolve, reject) => {
    const req = { url, method, body, headers: role ? { authorization: role } : {},
      query: Object.fromEntries(new URL(url, 'http://walking.test').searchParams) };
    const headers = new Map();
    const res = {
      statusCode: 200,
      set(key, value) { headers.set(key.toLowerCase(), value); return this; },
      status(value) { this.statusCode = value; return this; },
      json(value) { resolve({ status: this.statusCode, headers: { get: key => headers.get(key) }, json: async () => value }); },
      sendStatus(value) { this.status(value).json({}); },
    };
    router.handle(req, res, error => error ? reject(error) : res.sendStatus(404));
  });
    for (const method of ['GET', 'PUT']) {
      const body = method === 'PUT' ? { days: [snapshot()] } : undefined;
      assert.equal((await request('/me/daily-steps', method, body, '')).status, 401);
      assert.equal((await request('/me/daily-steps', method, body, 'null')).status, 401);
      assert.equal((await request('/me/daily-steps', method, body, 'CT')).status, 403);
      for (const query of ['ownerId=12', 'userId=12', 'unexpected=yes'])
        assert.equal((await request(`/me/daily-steps?${query}`, method, body)).status, 400);
      const response = await request('/me/daily-steps', method, body);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { success: true, data: { owner: { id: 11, name: 'Personal Owner' },
        today: '2026-11-25', oldestDate: '2026-11-19', days: [snapshot()] } });
    }
    for (const body of [{ days: [snapshot()], ownerId: 12 }, { days: [snapshot({ UserID: 12 })] }, { days: [] }])
      assert.equal((await request('/me/daily-steps', 'PUT', body)).status, 400);
    assert.equal((await request('/patrons/12/daily-steps')).status, 404);
    assert.equal((await request('/me/daily-steps', 'POST', { days: [snapshot()] })).status, 404);
    const goals = { dailySteps: 3000 }, walk = { clientId: 'legacy' };
    for (const [url, method, body, expected] of [['/me?userId=12', 'GET', undefined, 'overview'],
      ['/me/goals', 'PUT', goals, 'goals'], ['/me/walks', 'POST', walk, 'create'],
      ['/me/days/2026-11-25?before=42', 'GET', undefined, 'history'], ['/me/walks/5', 'DELETE', undefined, 'remove']]) {
      assert.deepEqual(await (await request(url, method, body)).json(), { success: true, data: { legacy: expected } });
    }
    const caller = { ...user, RoleCode: 'PTA' };
    assert.deepEqual(legacyCalls, [{ method: 'overview', args: [caller] }, { method: 'goals', args: [caller, goals] },
      { method: 'create', args: [caller, walk] }, { method: 'history', args: [caller, '2026-11-25', '42'] },
      { method: 'remove', args: [caller, '5'] }]);
});
