const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mysql = require('mysql2/promise');
const { createCareWorkflow } = require('../src/services/careWorkflow.service');
const { assertPatronAccess } = require('../src/middlewares/careAccess.middleware');
const v = require('../src/utils/careWorkflow');
const socketPath = process.env.MORNING_REMINDER_TEST_SOCKET;
test(
  'caretaker workflow against the complete existing schema and stored procedures',
  { skip: !socketPath && 'Isolated local socket required' },
  async (t) => {
    assert.match(socketPath, /^\/(?:private\/)?tmp\/eldara-[^/]+\.sock$/);
    const database = `eldara_care_test_${process.pid}`,
      admin = await mysql.createConnection({ socketPath, user: 'root', multipleStatements: true });
    let pool;
    try {
      await admin.query(`CREATE DATABASE ${database}`);
      const snapshot = path.join(
        __dirname,
        '../../ELDARADB/BACKUPS/2026-10-26-updated-schema/eldara_structure_and_stored_programs.sql'
      );
      const fd = fs.openSync(snapshot, 'r');
      try {
        execFileSync(
          '/opt/homebrew/bin/mysql',
          ['--protocol=SOCKET', `--socket=${socketPath}`, '--user=root', database],
          { stdio: [fd, 'pipe', 'pipe'] }
        );
      } finally {
        fs.closeSync(fd);
      }
      await admin.query(`USE ${database}`);
      const routines = async () =>
        (
          await admin.query(
            `SELECT ROUTINE_NAME,ROUTINE_DEFINITION FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? ORDER BY ROUTINE_NAME`,
            [database]
          )
        )[0];
      const before = await routines();
      assert.equal(before.length, 46);
      await admin.query(`SET FOREIGN_KEY_CHECKS=0;
    INSERT INTO GenderMaster(GenderID,GenderCode,GenderName,IsActive) VALUES(1,'M','Male',1),(2,'F','Female',1);
    INSERT INTO RoleMaster(RoleID,RoleCode,RoleName,IsActive) VALUES(1,'PTA','Patron Admin',1),(2,'CT','Caretaker',1),(3,'PT','Patron',1);
    INSERT INTO CityMaster(CityID,DistrictID,CityName,IsActive) VALUES(1,1,'Chennai',1),(2,1,'Madurai',1);
    INSERT INTO GeoMappingDetails(GeoMappingID,CountryID,ProvinceID,DistrictID,CityID,AreaID) VALUES(1,1,1,1,1,1),(2,1,1,1,2,1);
    INSERT INTO UserMaster(UserID,FirstName,LastName,MobileNumber,EmailID,GenderID,DOB,StatusID,GeoMappingID,MemberGroupID) VALUES
     (101,'Admin','One','1000000001','admin1@example.invalid',1,'1990-01-01',1,1,10),
     (102,'Patron','One','1000000002','patron1@example.invalid',1,'1960-02-01',1,1,10),
     (103,'Admin','Two','1000000003','admin2@example.invalid',2,'1980-01-01',1,2,20),
     (104,'Carer','One','1000000004','carer1@example.invalid',2,'1990-02-01',1,1,30),
     (105,'Carer','Two','1000000005','carer2@example.invalid',1,'2000-02-01',1,2,40),
     (106,'Carer','Old','1000000006','carer3@example.invalid',1,'1999-02-01',1,2,50),
     (107,'Carer','4',NULL,NULL,1,NULL,1,1,60),(108,'Carer','5',NULL,NULL,1,NULL,1,1,70),
     (109,'Carer','6',NULL,NULL,1,NULL,1,1,80),(110,'Carer','7',NULL,NULL,1,NULL,1,1,90);
    INSERT INTO UserRoleMapping(UserID,RoleID,IsActive) VALUES(101,1,1),(102,3,1),(103,1,1),(104,2,1),(105,2,1),(106,2,1),(107,2,1),(108,2,1),(109,2,1),(110,2,1);
    INSERT INTO CaretakerPatronMapping(PatronId,CaretakerId,CreatedBy,IsActive) VALUES(102,106,101,1);
    SET FOREIGN_KEY_CHECKS=1;`);
      const sql = fs.readFileSync(
        path.join(__dirname, '../migrations/20261117_caretaker_workflow.sql'),
        'utf8'
      );
      await admin.query(sql);
      await admin.query(sql);
      assert.deepEqual(await routines(), before);
      pool = mysql.createPool({
        socketPath,
        user: 'root',
        database,
        dateStrings: ['DATE'],
        connectionLimit: 8,
      });
      const service = createCareWorkflow(pool);
      const pta = { UserID: 101, RoleCode: 'PTA' },
        other = { UserID: 103, RoleCode: 'PTA' },
        ct = { UserID: 104, RoleCode: 'CT' },
        ct2 = { UserID: 105, RoleCode: 'CT' };
      const prefs = {
        accepting: true,
        workType: 'either',
        slots: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, from: '06:00', to: '22:00' })),
        leaves: [],
      };
      await service.saveAvailability(ct, prefs);
      await service.saveAvailability(ct2, prefs);
      const today = v.indiaDate();
      const proposal = {
        caretakerId: 104,
        patronId: 102,
        kind: 'weekly',
        workType: 'part-time',
        fromDate: today,
        toDate: null,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        fromTime: '09:00',
        toTime: '13:00',
        notes: 'Private care notes',
      };
      let contact, id;
      await t.test(
        'all caretakers are listed and filters are applied without private contact fields',
        async () => {
          const found = await service.search(pta);
          assert.equal(found.total, 7);
          assert.ok(!JSON.stringify(found).includes('1000000004'));
          assert.ok(!JSON.stringify(found).includes('example.invalid'));
          assert.ok(!JSON.stringify(found).includes('patronId'));
          const filtered = await service.search(pta, {
            city: 1,
            gender: 2,
            minAge: 30,
            maxAge: 40,
          });
          assert.deepEqual(
            filtered.items.map((x) => x.caretakerId),
            [104]
          );
          await assert.rejects(service.search(ct), (e) => e.status === 403);
        }
      );
      await t.test(
        'requests are unique, messages are participant-only, accepted and idempotent',
        async () => {
          contact = await service.requestContact(pta, {
            caretakerId: 104,
            introduction: 'Weekday support please',
          });
          assert.equal(
            (await service.requestContact(pta, { caretakerId: 104, introduction: 'Repeat' })).id,
            contact.id
          );
          await assert.rejects(
            service.sendMessage(pta, contact.id, { body: 'Before acceptance', clientId: 'a' }),
            (e) => e.status === 403
          );
          await assert.rejects(service.messages(other, contact.id), (e) => e.status === 404);
          await service.respondContact(ct, contact.id, { state: 'accepted' });
          const message = await service.sendMessage(pta, contact.id, {
            body: 'Private message',
            clientId: 'message-1',
          });
          assert.equal(
            (await service.sendMessage(pta, contact.id, { body: 'Retry', clientId: 'message-1' }))
              .id,
            message.id
          );
          assert.equal((await service.contacts(ct))[0].unread, 1);
          const history = await service.messages(ct, contact.id);
          assert.match(history.items[0].createdAt, /Z$/);
          await service.markRead(ct, contact.id, { through: message.id });
          assert.equal((await service.contacts(ct))[0].unread, 0);
        }
      );
      await t.test(
        'proposals require ownership and confirmation before health access',
        async () => {
          await assert.rejects(service.propose(other, proposal), (e) => e.status === 403);
          await assert.rejects(assertPatronAccess(pool, ct, 102), (e) => e.status === 403);
          id = (await service.propose(pta, proposal)).id;
          await assert.rejects(assertPatronAccess(pool, ct, 102), (e) => e.status === 403);
          await service.respondAssignment(ct, id, { state: 'active' });
          assert.equal(await assertPatronAccess(pool, ct, 102), 102);
          await assert.rejects(
            service.propose(pta, { ...proposal, patronId: 101 }),
            (e) => e.status === 409
          );
          await assert.rejects(
            service.saveAvailability(ct, {
              ...prefs,
              leaves: [{ fromDate: today, toDate: today }],
            }),
            (e) => e.status === 409
          );
        }
      );
      await t.test(
        'unassignment revokes access, permits an optional review and keeps separate periods',
        async () => {
          await service.endAssignment(pta, id);
          await assert.rejects(assertPatronAccess(pool, ct, 102), (e) => e.status === 403);
          assert.equal((await service.reviews(pta, 104)).length, 0);
          await service.review(pta, id, { rating: 4, feedback: 'Good support' });
          await service.reply(ct, id, { reply: 'Thank you' });
          await service.review(pta, id, { rating: 5, feedback: 'Updated feedback' });
          const review = (await service.reviews(pta, 104))[0];
          assert.equal(Number(review.rating), 5);
          assert.equal(review.reply, 'Thank you');
          await assert.rejects(service.review(other, id, { rating: 1 }), (e) => e.status === 404);
          const second = (await service.propose(pta, proposal)).id;
          await service.respondAssignment(ct, second, { state: 'active' });
          await service.endAssignment(pta, second);
          await service.review(pta, second, { rating: 4 });
          assert.equal((await service.reviews(pta, 104)).length, 2);
        }
      );
      await t.test('blocking prevents messages/proposals and reports do not auto-ban', async () => {
        await service.blockContact(ct, contact.id, { blocked: true });
        await assert.rejects(
          service.sendMessage(pta, contact.id, { body: 'Blocked', clientId: 'blocked' }),
          (e) => e.status === 403
        );
        await assert.rejects(service.propose(pta, proposal), (e) => e.status === 403);
        await service.reportContact(ct, contact.id, { reason: 'Test report' });
        await assert.rejects(
          service.reportContact(ct, contact.id, { reason: 'Repeat' }),
          (e) => e.status === 409
        );
        await service.blockContact(ct, contact.id, { blocked: false });
        await service.sendMessage(pta, contact.id, { body: 'Unblocked', clientId: 'unblocked' });
      });
      await t.test('same time cannot be confirmed by two employers under concurrency', async () => {
        const otherContact = await service.requestContact(other, {
          caretakerId: 104,
          introduction: 'Other work',
        });
        await service.respondContact(ct, otherContact.id, { state: 'accepted' });
        const one = (await service.propose(pta, proposal)).id,
          two = (await service.propose(other, { ...proposal, patronId: 103 })).id;
        const results = await Promise.allSettled([
          service.respondAssignment(ct, one, { state: 'active' }),
          service.respondAssignment(ct, two, { state: 'active' }),
        ]);
        assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
        assert.equal(results.filter((x) => x.status === 'rejected').length, 1);
      });
      await t.test(
        'max five new contact requests per IST day; old assignments preserved without invented hours',
        async () => {
          for (const caretakerId of [105, 106, 107, 108])
            await service.requestContact(pta, { caretakerId, introduction: 'Care request' });
          await assert.rejects(
            service.requestContact(pta, { caretakerId: 109, introduction: 'Sixth' }),
            (e) => e.status === 429
          );
          const legacy = (await service.assignments(pta)).filter((a) => a.kind === 'legacy');
          assert.equal(legacy.length, 1);
          assert.equal(legacy[0].fromMinute, null);
          assert.equal(await assertPatronAccess(pool, { UserID: 106, RoleCode: 'CT' }, 102), 102);
        }
      );
    } finally {
      if (pool) await pool.end();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    }
  }
);
