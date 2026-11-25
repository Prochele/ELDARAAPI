const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const mysql=require('mysql2/promise');
const {createWalkingService}=require('../src/services/walking.service');
const {createWalkingRouter}=require('../src/routes/walking.routes');
const socketPath=process.env.WELLNESS_TEST_SOCKET;
test('personal walking access, retries, goals, history and cleanup against isolated MySQL',{skip:!socketPath},async t=>{
  const database=`walking_test_${process.pid}`;
  const setup=await mysql.createConnection({socketPath,user:'root',multipleStatements:true});
  await setup.query(`CREATE DATABASE ${database}`); await setup.changeUser({database});
  await setup.query(`CREATE TABLE UserMaster(UserID BIGINT PRIMARY KEY,FirstName VARCHAR(100),LastName VARCHAR(100),MemberGroupID BIGINT,StatusID INT);
    INSERT INTO UserMaster VALUES(1,'Admin','One',10,1),(2,'Patron','One',10,1),(3,'Admin','Two',10,1),(4,'Caretaker','One',10,1),(5,'Inactive','One',10,0);`);
  await setup.query(fs.readFileSync(path.join(__dirname,'../migrations/20261123_walking.sql'),'utf8'));
  await setup.query(fs.readFileSync(path.join(__dirname,'../migrations/20261125_walking_daily.sql'),'utf8'));
  const pool=mysql.createPool({socketPath,user:'root',database,dateStrings:true});
  const clock=()=>new Date('2026-11-23T12:00:00Z'), service=createWalkingService({pool,clock});
  const admin={UserID:1,RoleCode:'PTA'}, patron={UserID:2,RoleCode:'PT'}, ct={UserID:4,RoleCode:'CT'};
  const uuid=n=>`2cf040b7-e8d1-4055-a044-${String(n).padStart(12,'0')}`;
  const walk=(n,extra={})=>({clientId:uuid(n),date:'2026-11-23',steps:1000,distanceMeters:650,activeSeconds:600,source:'manual',distanceSource:'manual',...extra});
  const rejects=(promise,status)=>assert.rejects(promise,e=>e.status===status);
  let entry;
  try {
    await t.test('patron and admin in the same group have independent records and goals',async()=>{
      entry=await service.create(patron,walk(1));
      assert.equal((await service.overview(admin)).days.length,0);
      assert.equal((await service.overview(patron)).days[0].steps,1000);
      const goals=await service.goals(admin,{dailySteps:3000,weeklySteps:21000,strideCm:70,version:0});
      assert.equal(goals.version,1); assert.equal((await service.overview(patron)).goals.dailySteps,null);
      await rejects(service.remove(admin,entry.id),404);
      assert.equal((await service.history(admin,'2026-11-23')).items.length,0);
    });
    await t.test('caretakers and inactive users cannot access walking via any action',async()=>{
      for(const user of [ct,{UserID:5,RoleCode:'PT'}]) {
        await rejects(service.overview(user),403); await rejects(service.create(user,walk(2)),403);
        await rejects(service.history(user,'2026-11-23'),403); await rejects(service.remove(user,entry.id),403);
        await rejects(service.goals(user,{dailySteps:null,weeklySteps:null,strideCm:65,version:0}),403);
      }
      for(const RoleCode of ['PTASelf','PTAFamily']) assert.equal((await service.overview({...admin,RoleCode})).owner.id,1);
    });
    await t.test('concurrent retries save one walk; changed data cannot reuse a saved retry identifier',async()=>{
      const result=await Promise.all([service.create(patron,walk(2)),service.create(patron,walk(2))]);
      assert.equal(result[0].id,result[1].id); assert.equal((await service.overview(patron)).days[0].steps,2000);
      await rejects(service.create(patron,walk(2,{steps:2000})),409);
      await service.create(admin,walk(2)); assert.equal((await service.overview(admin)).days[0].steps,1000);
    });
    await t.test('goal updates reject stale values without modifying the current goal',async()=>{
      await service.goals(admin,{dailySteps:4000,weeklySteps:null,strideCm:70,version:1});
      await rejects(service.goals(admin,{dailySteps:9999,weeklySteps:9999,strideCm:65,version:1}),409);
      await rejects(service.goals(admin,{dailySteps:9999,weeklySteps:9999,strideCm:65,version:0}),409);
      assert.equal((await service.overview(admin)).goals.dailySteps,4000);
    });
    await t.test('totals preserve missing distances and delete only the owners walk',async()=>{
      const r=await service.create(patron,walk(3,{distanceMeters:null,distanceSource:'unavailable'}));
      const before=(await service.overview(patron)).days[0]; assert.equal(before.steps,3000); assert.equal(before.missingDistances,1);
      await service.remove(patron,r.id); assert.equal((await service.overview(patron)).days[0].steps,2000);
      const only=await service.create(patron,walk(4,{date:'2026-11-22',distanceMeters:null,distanceSource:'unavailable'}));
      assert.equal((await service.overview(patron)).days.find(d=>d.date==='2026-11-22').distanceMeters,null);
      await service.remove(patron,only.id);
    });
    await t.test('history is paginated and scoped to the caller even within a shared family',async()=>{
      for(let n=10;n<62;n++) await service.create(patron,walk(n,{date:'2026-11-21'}));
      const first=await service.history(patron,'2026-11-21'); assert.equal(first.items.length,50); assert.ok(first.nextBefore);
      const second=await service.history(patron,'2026-11-21',first.nextBefore); assert.equal(second.items.length,2); assert.equal(second.nextBefore,null);
      assert.equal((await service.history(admin,'2026-11-21',first.nextBefore)).items.length,0);
    });
    await t.test('HTTP endpoints never expose a managed-patron route or accept an owner supplied in the body',async()=>{
      const app=require('express')(); app.use(require('express').json());
      app.use('/walking',createWalkingRouter({service,authenticate:(req,res,next)=>{
        const user={admin,patron,ct}[req.headers.authorization]; if(!user)return res.sendStatus(401);req.user=user;next();
      }}));
      const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
      const base=`http://127.0.0.1:${server.address().port}/walking`;
      try {
        assert.equal((await fetch(`${base}/me`)).status,401);
        assert.equal((await fetch(`${base}/me`,{headers:{authorization:'ct'}})).status,403);
        assert.equal((await fetch(`${base}/patrons/2`,{headers:{authorization:'admin'}})).status,404);
        const own=await(await fetch(`${base}/me?userId=2`,{headers:{authorization:'admin'}})).json();assert.equal(own.data.owner.id,1);
        assert.equal((await fetch(`${base}/me/walks`,{method:'POST',headers:{authorization:'admin','content-type':'application/json'},body:JSON.stringify({...walk(999),UserID:2})})).status,400);
      } finally {await new Promise(r=>server.close(r));}
    });
    await t.test('daily snapshots keep atomic maxima, no-op retries and matching estimates without summing walks or phones',async()=>{
      const day=(extra={})=>({date:'2026-11-23',steps:0,distanceMeters:0,distanceSource:'step-estimate',...extra});
      const write=(svc,user,value)=>svc.putDailySteps(user,{days:[day(value)]});
      assert.equal((await write(service,patron,{})).days[0].steps,0);
      assert.deepEqual((await service.dailySteps(admin)).days,[]);
      assert.equal((await service.overview(patron)).days.find(d=>d.date==='2026-11-23').steps,2000);
      await write(service,patron,{steps:4000,distanceMeters:2600});
      const stored=async()=> (await pool.query('SELECT * FROM WalkingDailySnapshot WHERE UserID=2 AND SnapshotDate=?',['2026-11-23']))[0][0];
      const original=await stored();
      const later=createWalkingService({pool,clock:()=>new Date('2026-11-23T13:00:00Z')});
      for(const value of [{steps:4000,distanceMeters:2600},{steps:4000,distanceMeters:9999,distanceSource:'device-estimate'},
        {steps:1,distanceMeters:200000,distanceSource:'device-estimate'}]) {
        await write(later,patron,value);assert.deepEqual(await stored(),original);
      }
      await Promise.all([
        write(later,patron,{steps:12000,distanceMeters:7000,distanceSource:'device-estimate'}),
        write(later,patron,{steps:8000,distanceMeters:5200}),
        write(later,patron,{steps:10000,distanceMeters:6500}),
      ]);
      assert.deepEqual((await service.dailySteps(patron)).days,[day({steps:12000,distanceMeters:7000,distanceSource:'device-estimate'})]);
      await write(later,patron,{steps:12100,distanceMeters:1});
      assert.deepEqual((await service.dailySteps(patron)).days,[day({steps:12100,distanceMeters:1})]);
      await write(service,admin,{steps:9999,distanceMeters:6000});
      assert.equal((await service.dailySteps(patron)).days[0].steps,12100);
      assert.equal((await service.dailySteps(admin)).days[0].steps,9999);
      assert.equal((await service.overview(patron)).days.find(d=>d.date==='2026-11-23').steps,2000);
      await rejects(service.putDailySteps(patron,{days:[day({date:'2026-11-22',steps:123}),day({date:'2026-11-24'})]}),400);
      assert.equal((await service.dailySteps(patron)).days.length,1);
      await service.putDailySteps(patron,{days:[day({date:'2026-11-17'}),day({date:'2026-11-18'})]});
      await write(service,{UserID:3,RoleCode:'PTA'},{steps:1234,distanceMeters:800});
    });
    await t.test('seven-day cleanup deletes old walks and snapshots including snapshot-only inactive owners',async()=>{
      await service.create(patron,walk(100,{date:'2026-11-17'}));await service.create(patron,walk(101,{date:'2026-11-18'}));
      await pool.query('UPDATE UserMaster SET StatusID=0 WHERE UserID=1');
      await pool.query('UPDATE UserMaster SET StatusID=0 WHERE UserID=3');
      const next=createWalkingService({pool,clock:()=>new Date('2026-11-24T12:00:00Z')});await next.cleanup();
      assert.equal((await next.overview(patron)).days.some(d=>d.date==='2026-11-17'),false);
      assert.equal((await next.overview(patron)).days.some(d=>d.date==='2026-11-18'),true);
      const [goals]=await pool.query('SELECT * FROM WalkingGoal WHERE UserID=1');assert.equal(goals.length,0);
      const daily=await next.dailySteps(patron);
      assert.deepEqual(daily.days.map(d=>d.date),['2026-11-23','2026-11-18']);
      const [inactiveSnapshots]=await pool.query('SELECT * FROM WalkingDailySnapshot WHERE UserID IN (1,3)');
      assert.equal(inactiveSnapshots.length,0);
      await rejects(next.history(patron,'2026-11-17'),400);
    });
  } finally {await pool.end();await setup.query(`DROP DATABASE ${database}`);await setup.end();}
});
