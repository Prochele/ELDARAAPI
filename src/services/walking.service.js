const v = require('../utils/walking');
const { fail, number } = require('../utils/careWorkflow');
const columns = `ID id,ClientID clientId,WalkDate date,Steps steps,DistanceMeters distanceMeters,
  ActiveSeconds activeSeconds,Source source,DistanceSource distanceSource,CreatedAt createdAt`;
const createWalkingService = ({ pool, accessPool = pool, clock = () => new Date() }) => {
  const q = async (db, sql, args = []) => (await db.query({ sql, dateStrings: true }, args))[0];
  const owner = async user => {
    if (!v.roles.includes(user.RoleCode)) fail('Walking is available only for your personal Patron or Patron Admin account.', 403);
    const id = number(user.UserID);
    const [row] = await q(accessPool, `SELECT UserID id,CONCAT_WS(' ',FirstName,LastName) name
      FROM UserMaster WHERE UserID=? AND StatusID=1 LIMIT 1`, [id]);
    if (!row) fail('This account is no longer active.', 403);
    return { id, name: row.name };
  };
  const goals = async id => {
    const [row] = await q(pool, `SELECT DailySteps dailySteps,WeeklySteps weeklySteps,StrideCm strideCm,Version version
      FROM WalkingGoal WHERE UserID=?`, [id]);
    return row || { dailySteps: null, weeklySteps: null, strideCm: 65, version: 0 };
  };
  return {
    async overview(user) {
      const person = await owner(user), w = v.window(clock());
      const days = await q(pool, `SELECT WalkDate date,SUM(Steps) steps,SUM(DistanceMeters) distanceMeters,
        SUM(ActiveSeconds) activeSeconds,COUNT(*) walks,SUM(DistanceMeters IS NULL) missingDistances
        FROM WalkingLog WHERE UserID=? AND WalkDate BETWEEN ? AND ? GROUP BY WalkDate ORDER BY WalkDate DESC`,
      [person.id, w.oldestDate, w.today]);
      return { owner: person, today: w.today, oldestDate: w.oldestDate, weekStart: w.weekStart,
        goals: await goals(person.id), days: days.map(d => ({ ...d, steps: Number(d.steps),
          distanceMeters: d.distanceMeters === null ? null : Number(d.distanceMeters),
          activeSeconds: Number(d.activeSeconds), walks: Number(d.walks), missingDistances: Number(d.missingDistances) })) };
    },
    async goals(user, body) {
      const person = await owner(user), b = v.goal(body), w = v.window(clock());
      if (b.version === 0) {
        try {
          await q(pool, `INSERT INTO WalkingGoal(UserID,DailySteps,WeeklySteps,StrideCm,UpdatedAt) VALUES(?,?,?,?,?)`,
            [person.id,b.dailySteps,b.weeklySteps,b.strideCm,w.now]);
        } catch (e) { if (e.code === 'ER_DUP_ENTRY') fail('Your goals changed. Reload before saving again.', 409); throw e; }
      } else {
        const r = await q(pool, `UPDATE WalkingGoal SET DailySteps=?,WeeklySteps=?,StrideCm=?,UpdatedAt=?,Version=Version+1
          WHERE UserID=? AND Version=?`, [b.dailySteps,b.weeklySteps,b.strideCm,w.now,person.id,b.version]);
        if (!r.affectedRows) fail('Your goals changed. Reload before saving again.', 409);
      }
      return goals(person.id);
    },
    async create(user, body) {
      const person = await owner(user), w = v.window(clock()), b = v.walk(body, w);
      try {
        const r = await q(pool, `INSERT INTO WalkingLog(UserID,ClientID,WalkDate,Steps,DistanceMeters,ActiveSeconds,Source,DistanceSource,CreatedAt)
          VALUES(?,?,?,?,?,?,?,?,?)`, [person.id,b.clientId,b.date,b.steps,b.distanceMeters,b.activeSeconds,b.source,b.distanceSource,w.now]);
        return { id: Number(r.insertId), message: 'Walk saved.' };
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
        const [old] = await q(pool, `SELECT ${columns} FROM WalkingLog WHERE UserID=? AND ClientID=?`, [person.id,b.clientId]);
        if (!old || ['date','steps','distanceMeters','activeSeconds','source','distanceSource'].some(k => old[k] !== b[k]))
          fail('This walk was already saved with different details. Refresh your history.', 409);
        return { id: Number(old.id), message: 'Walk already saved.' };
      }
    },
    async history(user, date, before) {
      const person = await owner(user), w = v.window(clock()), chosen = v.day(date,w);
      const args = [person.id, chosen];
      if (before !== undefined) args.push(number(before));
      const rows = await q(pool, `SELECT ${columns} FROM WalkingLog WHERE UserID=? AND WalkDate=?
        ${before === undefined ? '' : 'AND ID<?'} ORDER BY ID DESC LIMIT 51`, args);
      return { items: rows.slice(0,50).map(r => ({...r,id:Number(r.id),createdAt:r.createdAt.replace(' ','T')+'Z'})),
        nextBefore: rows.length > 50 ? Number(rows[49].id) : null };
    },
    async remove(user, id) {
      const person = await owner(user), w = v.window(clock());
      const r = await q(pool, `DELETE FROM WalkingLog WHERE ID=? AND UserID=? AND WalkDate BETWEEN ? AND ?`,
        [number(id),person.id,w.oldestDate,w.today]);
      if (!r.affectedRows) fail('This walk was deleted or is outside your seven-day history.', 404);
      return { deleted: true };
    },
    async cleanup() {
      const w = v.window(clock()); let removed = 0;
      for (let batch=0;batch<100;batch++) {
        const r = await q(pool, 'DELETE FROM WalkingLog WHERE WalkDate<? LIMIT 500', [w.oldestDate]);
        removed += r.affectedRows; if (r.affectedRows < 500) break;
      }
      // Local review can use a separate, read-only identity pool.
      let after=0;
      for (let batch=0;batch<500;batch++) {
        const ids=(await q(pool, `SELECT UserID id FROM (SELECT UserID FROM WalkingLog UNION SELECT UserID FROM WalkingGoal) owners
          WHERE UserID>? ORDER BY UserID LIMIT 500`, [after])).map(r=>Number(r.id));
        if (!ids.length) break;
        const active=new Set((await q(accessPool,'SELECT UserID id FROM UserMaster WHERE StatusID=1 AND UserID IN (?)',[ids])).map(r=>Number(r.id)));
        const inactive=ids.filter(id=>!active.has(id));
        if (inactive.length) {
          await q(pool,'DELETE FROM WalkingLog WHERE UserID IN (?)',[inactive]);
          await q(pool,'DELETE FROM WalkingGoal WHERE UserID IN (?)',[inactive]);
        }
        after=ids.at(-1); if (ids.length<500) break;
      }
      return { removed };
    },
  };
};
module.exports = { createWalkingService };
