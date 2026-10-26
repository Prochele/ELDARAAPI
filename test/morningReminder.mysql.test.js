const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { createMorningReminderRepository } = require('../src/repositories/morningReminder.repository');

const socketPath = process.env.MORNING_REMINDER_TEST_SOCKET;

test('morning reminder migration and queries on an isolated local MySQL database', {
  skip: !socketPath && 'Set MORNING_REMINDER_TEST_SOCKET to an isolated /tmp/eldara-* socket',
}, async t => {
  assert.match(socketPath, /^\/(?:private\/)?tmp\/eldara-[^/]+\.sock$/);
  const database = `eldara_morning_test_${process.pid}`;
  const admin = await mysql.createConnection({ socketPath, user: 'root', multipleStatements: true });
  let pool;
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    await admin.query(`USE ${database}`);
    await admin.query(`
      CREATE TABLE UserMaster (UserID BIGINT PRIMARY KEY, StatusID INT);
      CREATE TABLE UserDeviceInfo (DeviceID BIGINT PRIMARY KEY, UserID BIGINT,
        DeviceUUID VARCHAR(100), Platform VARCHAR(20), PushToken VARCHAR(255));
      CREATE TABLE UserTokens (UserID BIGINT, DeviceID BIGINT, AccessToken VARCHAR(500), IsActive BOOLEAN);
      CREATE TABLE AppointmentStatusMaster (StatusId INT PRIMARY KEY, StatusName VARCHAR(30));
      CREATE TABLE DoctorAppointment (DoctorAppointmentId BIGINT PRIMARY KEY, PatronId BIGINT,
        AppointmentDate DATE, AppointmentTime TIME, DoctorName VARCHAR(100), StatusId INT);
      CREATE TABLE DailyActivity (DailyActivityId BIGINT PRIMARY KEY, UserId BIGINT,
        ActivityDate DATE, ActivityTime TIME, ActivityDescription VARCHAR(500));
      INSERT INTO UserMaster VALUES (1,1), (2,1), (3,0);
      INSERT INTO UserDeviceInfo VALUES (10,1,'phone-1','ANDROID','token-1'),
        (20,2,'phone-2','IOS','token-2'), (30,3,'phone-3','ANDROID','token-3'),
        (11,1,'old-client','ANDROID','token-old');
      INSERT INTO UserTokens VALUES (1,999,'session-1',TRUE), (2,20,'session-2',TRUE),
        (3,30,'session-3',TRUE);
      INSERT INTO AppointmentStatusMaster VALUES (1,'Scheduled'),(2,'Completed'),(3,'Cancelled'),
        (4,'Rescheduled'),(5,'Deleted');
      INSERT INTO DoctorAppointment VALUES
        (1,1,'2026-10-27','10:30:00','Kumar',1), (2,1,'2026-10-27','11:30:00','Cancelled',3),
        (3,1,'2026-10-27','12:00:00','Deleted',5), (4,1,'2026-10-27','13:00:00','Completed',2),
        (5,1,'2026-10-28','10:30:00','Tomorrow',1), (6,1,'2026-10-27','07:00:00','Past',1),
        (7,2,'2026-10-27','14:00:00','Rescheduled',4);
      INSERT INTO DailyActivity VALUES (1,1,'2026-10-27','18:00:00','Go to wedding'),
        (2,1,'2026-10-28','18:00:00','Tomorrow'), (3,1,'2026-10-27','06:00:00','Past');
    `);
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/20261026_morning_reminders.sql'), 'utf8');
    await admin.query(migration);
    await admin.query(migration);
    pool = mysql.createPool({ socketPath, user: 'root', database, dateStrings: ['DATE'], connectionLimit: 4 });
    const repo = createMorningReminderRepository(pool);

    await t.test('events retain correct dates and exclude cancelled, deleted, completed, past and tomorrow', async () => {
      const rows = await repo.findEvents('2026-10-27', '08:00:00');
      assert.deepEqual(rows.map(row => [row.ReminderType, row.SourceID, row.RecipientID]), [
        ['DOCTOR_APPOINTMENT', 1, 1], ['DAILY_ACTIVITY', 1, 1], ['DOCTOR_APPOINTMENT', 7, 2],
      ]);
      assert.equal(rows[0].ScheduleDate, '2026-10-27');
    });

    await t.test('preferences are per assignee, separate by type, and do not require medicine settings', async () => {
      assert.deepEqual(await repo.getPreferences(1), {
        appointmentRemindersEnabled: true, activityRemindersEnabled: true,
      });
      await repo.updatePreferences(1, { appointmentRemindersEnabled: false, activityRemindersEnabled: true });
      assert.deepEqual(await repo.getPreferences(1), {
        appointmentRemindersEnabled: false, activityRemindersEnabled: true,
      });
      const rows = await repo.findEvents('2026-10-27', '08:00:00');
      assert.equal(rows.filter(row => row.RecipientID === 1).length, 1);
      assert.equal(rows.filter(row => row.RecipientID === 2).length, 1);
      await repo.updatePreferences(1, { appointmentRemindersEnabled: true, activityRemindersEnabled: true });
    });

    await t.test('only opted-in clients, active users and the registering active session receive events', async () => {
      assert.deepEqual(await repo.findDevices(1), []);
      await repo.registerDevice(1, 'phone-1', 'token-1', true, 'session-1');
      await repo.registerDevice(2, 'phone-2', 'token-2', true, 'session-2');
      await repo.registerDevice(3, 'phone-3', 'token-3', true, 'session-3');
      assert.equal((await repo.findDevices(1)).length, 1);
      assert.equal((await repo.findDevices(1))[0].PushToken, 'token-1');
      assert.equal((await repo.findDevices(2))[0].Platform, 'IOS');
      assert.deepEqual(await repo.findDevices(3), []);
      await pool.query("UPDATE UserTokens SET IsActive = FALSE WHERE AccessToken = 'session-1'");
      assert.deepEqual(await repo.findDevices(1), []);
      await pool.query("UPDATE UserTokens SET IsActive = TRUE WHERE AccessToken = 'session-1'");
      await repo.registerDevice(2, 'phone-1', 'token-1', true, 'session-2');
      assert.deepEqual(await repo.findDevices(1), []);
      await repo.registerDevice(1, 'phone-1', 'token-1', true, 'session-1');
      await repo.registerDevice(1, 'phone-1', 'token-1', false);
      assert.deepEqual(await repo.findDevices(1), []);
    });

    const event = { ScheduleDate: '2026-10-27', ReminderType: 'DOCTOR_APPOINTMENT', SourceID: 1, RecipientID: 1 };
    const device = { DeviceUUID: 'phone-1' };
    await t.test('concurrent workers claim once, retries wait, and sent records cannot be reclaimed', async () => {
      const claims = await Promise.all([repo.claim(event, device), repo.claim(event, device)]);
      assert.equal(claims.filter(Boolean).length, 1);
      const firstClaim = claims.find(Boolean);
      await repo.fail(firstClaim, 'messaging/server-unavailable', false);
      assert.equal(await repo.claim(event, device), null);
      await pool.query('UPDATE MorningReminderDeliveries SET NextAttemptAt = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)');
      const secondClaim = await repo.claim(event, device);
      assert.ok(secondClaim);
      await repo.complete(firstClaim);
      let [rows] = await pool.query('SELECT Status FROM MorningReminderDeliveries');
      assert.equal(rows[0].Status, 'sending');
      await repo.complete(secondClaim);
      assert.equal(await repo.claim(event, device), null);
      [rows] = await pool.query('SELECT Status, AttemptCount FROM MorningReminderDeliveries');
      assert.equal(rows[0].Status, 'sent');
      assert.equal(rows[0].AttemptCount, 2);
    });

    await t.test('expired leases recover after a crash but no delivery exceeds five attempts', async () => {
      const late = { ...event, SourceID: 99 };
      for (let attempt = 0; attempt < 5; attempt++) {
        assert.ok(await repo.claim(late, device));
        await pool.query(`UPDATE MorningReminderDeliveries
          SET LockedUntil = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE SourceID = 99`);
      }
      assert.equal(await repo.claim(late, device), null);
    });
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
});
