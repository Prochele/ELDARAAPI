const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { createWellnessService } = require('../src/services/wellness.service');
const { createWellnessRouter } = require('../src/routes/wellness.routes');
const socketPath = process.env.WELLNESS_TEST_SOCKET;

test('Wellness access, edits, deletion, assistance and retention against isolated MySQL', { skip: !socketPath }, async t => {
  const database = `wellness_test_${process.pid}`;
  const setup = await mysql.createConnection({ socketPath, user: 'root', multipleStatements: true });
  await setup.query(`CREATE DATABASE ${database}`); await setup.changeUser({ database });
  await setup.query(`CREATE TABLE UserMaster(UserID BIGINT PRIMARY KEY,FirstName VARCHAR(100),LastName VARCHAR(100),MemberGroupID BIGINT,StatusID INT);
    CREATE TABLE PlanMaster(PlanID INT PRIMARY KEY,PlanCode VARCHAR(30));
    CREATE TABLE MemberGroupMaster(MemberGroupID BIGINT PRIMARY KEY,PlanID INT);
    INSERT INTO PlanMaster VALUES(1,'PREMIUM'),(2,'BASIC');
    INSERT INTO MemberGroupMaster VALUES(10,1),(20,1),(30,2);
    CREATE TABLE RoleMaster(RoleID INT PRIMARY KEY,RoleCode VARCHAR(20));
    CREATE TABLE UserRoleMapping(UserID BIGINT,RoleID INT,IsActive INT);
    CREATE TABLE CareAssignment(ID BIGINT PRIMARY KEY,PatronID BIGINT,CaretakerID BIGINT,State VARCHAR(20),FromDate DATE,ToDate DATE);
    INSERT INTO RoleMaster VALUES(1,'PTA'),(2,'PT'),(3,'CT'),(4,'PTASelf'),(5,'PTAFamily');
    INSERT INTO UserMaster VALUES(1,'Admin','One',10,1),(2,'Patron','One',10,1),(3,'Caretaker','One',20,1),
      (4,'Admin','Other',20,1),(5,'Patron','Other',20,1),(6,'Admin','SameGroup',10,1),(7,'Inactive','Patron',10,0),
      (8,'Patron','Unassigned',10,1),(9,'Caretaker','Unassigned',NULL,1),(10,'Self','Admin',10,1),(11,'Family','Admin',10,1),
      (13,'Basic','Admin',30,1),(14,'Former','ManagedPatron',30,1);
    INSERT INTO UserRoleMapping VALUES(1,1,1),(2,2,1),(3,3,1),(4,1,1),(5,2,1),(6,1,1),(7,2,1),(8,2,1),(9,3,1),(10,4,1),(11,5,1),(13,1,1),(14,2,1);
    INSERT INTO CareAssignment VALUES(1,2,3,'active','2026-11-01',NULL),(2,8,3,'pending','2026-11-01',NULL),
      (3,5,3,'ended','2026-11-01',NULL),(4,8,3,'active','2026-11-24',NULL),(5,6,3,'active','2026-11-01',NULL);`);
  await setup.query(fs.readFileSync(path.join(__dirname, '../migrations/20261123_wellness.sql'), 'utf8'));
  const pool = mysql.createPool({ socketPath, user: 'root', database, dateStrings: true });
  const fixed = new Date('2026-11-23T12:00:00Z');
  const service = createWellnessService({ pool, clock: () => fixed });
  const admin = { UserID: 1, RoleCode: 'PTA' }, patron = { UserID: 2, RoleCode: 'PT' }, ct = { UserID: 3, RoleCode: 'CT' };
  const fields = { feeling: 'well', sleepMinutes: 420, sleepQuality: 'rested', mood: 'calm', painLevel: 2, painLocation: 'Knee', notes: 'A short note' };
  const rejected = (promise, status) => assert.rejects(promise, e => e.status === status);
  let entry;
  try {
    await t.test('each account sees only Self/managed patrons or confirmed current assignments', async () => {
      assert.deepEqual((await service.patrons(admin)).items.map(p => p.id), [1, 2, 8]);
      assert.deepEqual((await service.patrons(patron)).items.map(p => p.id), [2]);
      assert.deepEqual((await service.patrons(ct)).items.map(p => p.id), [2]);
      assert.deepEqual((await service.patrons({ UserID: 9, RoleCode: 'CT' })).items, []);
      assert.deepEqual((await service.patrons({ UserID: 10, RoleCode: 'PTASelf' })).items.map(p => p.id), [10]);
      assert.deepEqual((await service.patrons({ UserID: 11, RoleCode: 'PTAFamily' })).items.map(p => p.id), [2, 8, 11]);
      assert.deepEqual((await service.patrons({ UserID: 13, RoleCode: 'PTA' })).items.map(p => p.id), [13]);
      await rejected(service.overview({ UserID: 13, RoleCode: 'PTA' }, 14), 403);
      for (const id of [3, 4, 5, 6, 7]) await rejected(service.overview(admin, id), 403);
      for (const id of [1, 5, 6, 8]) await rejected(service.overview(ct, id), 403);
      await rejected(service.overview(patron, 1), 403);
      await rejected(service.overview(admin, '1 OR 1=1'), 400);
    });
    await t.test('admin can enter Self and a patron; one entry per person/day is enforced concurrently', async () => {
      await service.create(admin, 1, { ...fields, date: '2026-11-23' });
      entry = await service.create(admin, 2, { ...fields, date: '2026-11-23' });
      await rejected(service.create(patron, 2, { ...fields, date: '2026-11-23' }), 409);
      const results = await Promise.allSettled([1, 2].map(() => service.create(admin, 8, { ...fields, date: '2026-11-22' })));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
    });
    await t.test('caretaker reads assigned entries but cannot create, edit, delete or manage assistance', async () => {
      const view = await service.overview(ct, 2);
      assert.equal(view.patron.canWrite, false); assert.equal(view.checkIns[0].id, entry.id);
      await rejected(service.create(ct, 2, { ...fields, date: '2026-11-22' }), 403);
      await rejected(service.update(ct, 2, entry.id, { ...fields, version: 1 }), 403);
      await rejected(service.remove(ct, 2, entry.id, { version: 1 }), 403);
      await rejected(service.createRequest(ct, 2, { category: 'other', description: 'No' }), 403);
      await rejected(service.updateRequest(ct, 2, 1, { state: 'resolved', version: 1 }), 403);
    });
    await t.test('edits retain attribution/history and reject stale or cross-person edits', async () => {
      await service.update(patron, 2, entry.id, { ...fields, mood: 'happy', version: 1 });
      const updated = (await service.overview(admin, 2)).checkIns[0];
      assert.equal(updated.version, 2); assert.equal(updated.enteredBy, 'Admin One'); assert.equal(updated.updatedBy, 'Patron One');
      const [audit] = await pool.query('SELECT * FROM WellnessCheckInEdit WHERE CheckInID=?', [entry.id]);
      assert.equal(audit.length, 1); assert.equal(audit[0].PreviousVersion, 1);
      await rejected(service.update(admin, 2, entry.id, { ...fields, version: 1 }), 409);
      await rejected(service.update(admin, 1, entry.id, { ...fields, version: 2 }), 404);
      await rejected(service.remove(admin, 1, entry.id, { version: 2 }), 409);
      await rejected(service.update({ UserID: 4, RoleCode: 'PTA' }, 2, entry.id, { ...fields, version: 2 }), 403);
    });
    await t.test('assistance stays open/acknowledged until resolution; resolving twice cannot extend retention', async () => {
      const result = await service.createRequest(patron, 2, { category: 'transport', description: 'Help arranging transport' });
      assert.match(result.message, /No notification/);
      await pool.query("UPDATE WellnessAssistance SET CreatedAt='2020-01-01',UpdatedAt='2020-01-01' WHERE ID=?", [result.id]);
      await service.cleanup(); assert.equal((await service.overview(ct, 2)).openRequests, 1);
      await service.updateRequest(admin, 2, result.id, { state: 'acknowledged', version: 1 });
      await service.cleanup(); assert.equal((await service.overview(patron, 2)).openRequests, 1);
      await service.updateRequest(admin, 2, result.id, { state: 'resolved', version: 2 });
      await rejected(service.updateRequest(admin, 2, result.id, { state: 'resolved', version: 3 }), 409);
      assert.equal((await service.overview(patron, 2)).openRequests, 0);
      await rejected(service.requests({ UserID: 4, RoleCode: 'PTA' }, 2), 403);
    });
    await t.test('deleting an entry also deletes its edit history', async () => {
      await service.remove(admin, 2, entry.id, { version: 2 });
      assert.equal((await service.overview(patron, 2)).checkIns.length, 0);
      const [audit] = await pool.query('SELECT ID FROM WellnessCheckInEdit WHERE CheckInID=?', [entry.id]); assert.equal(audit.length, 0);
    });
    await t.test('nightly retention removes expired check-ins/audits and resolved requests at the correct boundary', async () => {
      const old = await service.create(patron, 2, { ...fields, date: '2026-11-17' });
      await service.update(patron, 2, old.id, { ...fields, version: 1 });
      await service.create(patron, 2, { ...fields, date: '2026-11-18' });
      const first = await service.createRequest(patron, 2, { category: 'other', description: 'Expired resolved request' });
      const boundary = await service.createRequest(patron, 2, { category: 'other', description: 'Boundary resolved request' });
      await pool.query("UPDATE WellnessAssistance SET State='resolved',ResolvedAt='2026-11-17 11:59:59.999' WHERE ID=?", [first.id]);
      await pool.query("UPDATE WellnessAssistance SET State='resolved',ResolvedAt='2026-11-17 12:00:00.000' WHERE ID=?", [boundary.id]);
      const next = createWellnessService({ pool, clock: () => new Date('2026-11-24T12:00:00Z') });
      const result = await next.cleanup(); assert.equal(result.checkIns, 1); assert.equal(result.assistance, 1);
      assert.deepEqual((await next.overview(patron, 2)).checkIns.map(c => c.date), ['2026-11-18']);
      const [audit] = await pool.query('SELECT ID FROM WellnessCheckInEdit WHERE CheckInID=?', [old.id]); assert.equal(audit.length, 0);
    });
    await t.test('HTTP routes require authentication and reject role spoofing and cross-account IDs', async () => {
      const express = require('express'); const app = express(); app.use(express.json());
      app.use('/wellness', createWellnessRouter({ service, authenticate: (req, res, next) => {
        const who = { admin, patron, ct }[req.headers.authorization];
        if (!who) return res.status(401).json({ success: false }); req.user = who; next();
      } }));
      const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}/wellness`;
      try {
        assert.equal((await fetch(`${base}/patrons`)).status, 401);
        assert.equal((await fetch(`${base}/patrons/2`, { headers: { authorization: 'ct' } })).status, 200);
        assert.equal((await fetch(`${base}/patrons/5`, { headers: { authorization: 'ct' } })).status, 403);
        assert.equal((await fetch(`${base}/patrons/2/check-ins`, { method: 'POST', headers: { authorization: 'ct', 'content-type': 'application/json' }, body: JSON.stringify({ ...fields, date: '2026-11-23', RoleCode: 'PTA' }) })).status, 403);
      } finally { await new Promise(resolve => server.close(resolve)); }
    });
    await t.test('ended assignments immediately deny subsequent Wellness requests', async () => {
      await pool.query("UPDATE CareAssignment SET State='ended' WHERE ID=1");
      await rejected(service.overview(ct, 2), 403);
      assert.deepEqual((await service.patrons(ct)).items, []);
    });
    await t.test('deactivated accounts do not retain unresolved assistance forever', async () => {
      await service.createRequest(patron, 2, { category: 'other', description: 'Account will close' });
      await pool.query('UPDATE UserMaster SET StatusID=0 WHERE UserID=2');
      await service.cleanup();
      const [rows] = await pool.query('SELECT ID FROM WellnessAssistance WHERE PatronID=2'); assert.equal(rows.length, 0);
    });
  } finally {
    await pool.end(); await setup.query(`DROP DATABASE ${database}`); await setup.end();
  }
});
