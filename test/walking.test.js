const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/utils/walking');
const body = { clientId:'2cf040b7-e8d1-4055-a044-8c7833c31201',date:'2026-11-23',steps:1000,distanceMeters:650,
  activeSeconds:600,source:'manual',distanceSource:'manual' };
test('walking weeks start Monday and retention follows Indian calendar dates',()=>{
  const w=v.window(new Date('2026-11-22T18:30:00Z'));
  assert.equal(w.today,'2026-11-23'); assert.equal(w.weekStart,'2026-11-23'); assert.equal(w.oldestDate,'2026-11-17');
  assert.equal(v.window(new Date('2026-11-22T18:29:59Z')).weekStart,'2026-11-16');
});
test('walking rejects identity injection, fabricated sources, empty walks and expired dates',()=>{
  const w=v.window(new Date('2026-11-23T12:00:00Z'));
  assert.equal(v.walk(body,w).steps,1000);
  for(const extra of [{UserID:4},{patronId:2},{notifyFamily:true},{steps:-1},{steps:'1000'},{date:'2026-11-24'},{date:'2026-11-16'},{date:'2026-02-30'},
    {source:'manual',distanceSource:'device-estimate'},{distanceMeters:null,distanceSource:'manual'},{steps:0,activeSeconds:0,distanceMeters:0}])
    assert.throws(()=>v.walk({...body,...extra},w));
  assert.equal(v.walk({...body,distanceMeters:null,distanceSource:'unavailable'},w).distanceMeters,null);
});
test('walking goals can be disabled and reject invalid bounds or stale version formats',()=>{
  assert.equal(v.goal({dailySteps:null,weeklySteps:21000,strideCm:65,version:0}).dailySteps,null);
  for(const extra of [{dailySteps:0},{weeklySteps:700001},{strideCm:0},{version:'1'},{ownerId:1}])
    assert.throws(()=>v.goal({dailySteps:3000,weeklySteps:21000,strideCm:65,version:0,...extra}));
});
