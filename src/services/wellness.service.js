const v = require('../utils/wellness');

const checkColumns = `ID id,PatronID patronId,CheckInDate date,Feeling feeling,SleepMinutes sleepMinutes,
 SleepQuality sleepQuality,Mood mood,PainLevel painLevel,PainLocation painLocation,Notes notes,
 EnteredByID enteredById,UpdatedByID updatedById,CreatedAt createdAt,UpdatedAt updatedAt,Version version`;
const requestColumns = `ID id,PatronID patronId,RequestedByID enteredById,UpdatedByID updatedById,
 Category category,Description description,State state,CreatedAt createdAt,UpdatedAt updatedAt,ResolvedAt resolvedAt,Version version`;
const recentRequests = `(State<>'resolved' OR ResolvedAt>=?)`;
const createWellnessService = ({ pool, accessPool = pool, clock = () => new Date() }) => {
  const q = async (db, sql, args = []) => (await db.query({ sql, dateStrings: true }, args))[0];
  const window = () => v.windowFor(clock());
  const scope = async (user, patronId) => {
    if (!v.roles.includes(user.RoleCode)) v.fail('Wellness is not available for this account.', 403);
    const uid = v.number(user.UserID), today = window().today;
    const [owner] = await q(accessPool, `SELECT U.UserID id,PM.PlanCode planCode FROM UserMaster U
      LEFT JOIN MemberGroupMaster G ON G.MemberGroupID=U.MemberGroupID
      LEFT JOIN PlanMaster PM ON PM.PlanID=G.PlanID WHERE U.UserID=? AND U.StatusID=1 LIMIT 1`, [uid]);
    if (!owner) v.fail('This account is no longer active.', 403);
    const selfOnly = user.RoleCode === 'PTASelf' || owner.planCode === 'BASIC';
    let condition, args;
    if (user.RoleCode === 'CT') {
      condition = `EXISTS(SELECT 1 FROM CareAssignment A WHERE A.PatronID=P.UserID AND A.CaretakerID=?
        AND A.State='active' AND A.FromDate<=? AND (A.ToDate IS NULL OR A.ToDate>=?))
        AND EXISTS(SELECT 1 FROM UserRoleMapping M JOIN RoleMaster R ON R.RoleID=M.RoleID
          WHERE M.UserID=P.UserID AND M.IsActive=1 AND R.RoleCode='PT')`;
      args = [uid, today, today];
    } else if (['PTA', 'PTAFamily'].includes(user.RoleCode) && !selfOnly) {
      condition = `(P.UserID=? OR (P.MemberGroupID IS NOT NULL AND EXISTS(
        SELECT 1 FROM UserMaster U WHERE U.UserID=? AND U.StatusID=1 AND U.MemberGroupID=P.MemberGroupID)
        AND EXISTS(SELECT 1 FROM UserRoleMapping M JOIN RoleMaster R ON R.RoleID=M.RoleID
          WHERE M.UserID=P.UserID AND M.IsActive=1 AND R.RoleCode='PT')))`;
      args = [uid, uid];
    } else {
      condition = 'P.UserID=?'; args = [uid];
    }
    if (patronId !== undefined) { condition += ' AND P.UserID=?'; args.push(v.number(patronId)); }
    const rows = await q(accessPool, `SELECT DISTINCT P.UserID id,CONCAT_WS(' ',P.FirstName,P.LastName) name
      FROM UserMaster P WHERE P.StatusID=1 AND ${condition} ORDER BY P.UserID`, args);
    const items = rows.map(p => ({ ...p, id: Number(p.id), isSelf: Number(p.id) === uid,
      canWrite: user.RoleCode !== 'CT' }));
    if (patronId !== undefined && !items.length) v.fail('You no longer have access to this patron’s wellness.', 403);
    return patronId === undefined ? items : items[0];
  };
  const writable = async (user, patronId) => {
    if (user.RoleCode === 'CT') v.fail('Caretakers can only view assigned patrons’ wellness.', 403);
    return scope(user, patronId);
  };
  const tx = async (work) => {
    const db = await pool.getConnection();
    try { await db.beginTransaction(); const result = await work(db); await db.commit(); return result; }
    catch (e) { await db.rollback(); throw e; }
    finally { db.release(); }
  };
  const decorate = async (rows) => {
    if (!rows.length) return rows;
    const ids = [...new Set(rows.flatMap(r => [r.enteredById, r.updatedById]).filter(Boolean))];
    const names = new Map((await q(accessPool, `SELECT UserID id,CONCAT_WS(' ',FirstName,LastName) name
      FROM UserMaster WHERE UserID IN (?)`, [ids])).map(r => [Number(r.id), r.name]));
    return rows.map(row => {
      const r = { ...row, id: Number(row.id), patronId: Number(row.patronId), version: Number(row.version),
        enteredBy: names.get(Number(row.enteredById)) || 'Account holder',
        updatedBy: names.get(Number(row.updatedById)) || 'Account holder' };
      for (const key of ['createdAt', 'updatedAt', 'resolvedAt'])
        if (r[key]) r[key] = String(r[key]).replace(' ', 'T') + 'Z';
      return r;
    });
  };
  const requests = async (user, patronId, before) => {
    await scope(user, patronId);
    const w = window(), args = [v.number(patronId), w.resolvedCutoff];
    const cursor = before === undefined ? '' : ' AND ID<?';
    if (before !== undefined) args.push(v.number(before));
    const rows = await q(pool, `SELECT ${requestColumns} FROM WellnessAssistance WHERE PatronID=?
      AND ${recentRequests}${cursor} ORDER BY ID DESC LIMIT 21`, args);
    return { items: await decorate(rows.slice(0, 20)), nextBefore: rows.length > 20 ? Number(rows[19].id) : null };
  };
  return {
    scope,
    async patrons(user) { const w = window(); return { items: await scope(user), today: w.today, oldestDate: w.oldestDate }; },
    async overview(user, patronId) {
      const patron = await scope(user, patronId), w = window();
      const rows = await q(pool, `SELECT ${checkColumns} FROM WellnessCheckIn WHERE PatronID=?
        AND CheckInDate BETWEEN ? AND ? ORDER BY CheckInDate DESC`, [patron.id, w.oldestDate, w.today]);
      const [count] = await q(pool, `SELECT COUNT(*) total FROM WellnessAssistance
        WHERE PatronID=? AND State<>'resolved'`, [patron.id]);
      return { patron, today: w.today, oldestDate: w.oldestDate, checkIns: await decorate(rows),
        requests: await requests(user, patron.id), openRequests: Number(count.total) };
    },
    requests,
    async create(user, patronId, body) {
      const patron = await writable(user, patronId), w = window(), b = v.checkIn(body, w);
      try {
        const result = await q(pool, `INSERT INTO WellnessCheckIn
          (PatronID,CheckInDate,Feeling,SleepMinutes,SleepQuality,Mood,PainLevel,PainLocation,Notes,
           EnteredByID,UpdatedByID,CreatedAt,UpdatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [patron.id,b.date,b.feeling,b.sleepMinutes,b.sleepQuality,b.mood,b.painLevel,b.painLocation,b.notes,
          user.UserID,user.UserID,w.now,w.now]);
        return { id: Number(result.insertId), message: 'Check-in saved.' };
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') v.fail('A check-in already exists for this day. Open it to edit.', 409);
        throw e;
      }
    },
    async update(user, patronId, id, body) {
      const patron = await writable(user, patronId), w = window(), b = v.checkIn(body, w, true);
      return tx(async db => {
        const [old] = await q(db, `SELECT ${checkColumns} FROM WellnessCheckIn WHERE ID=? AND PatronID=?
          AND CheckInDate BETWEEN ? AND ? FOR UPDATE`, [v.number(id),patron.id,w.oldestDate,w.today]);
        if (!old) v.fail('This check-in was deleted or is outside the seven-day history.', 404);
        if (Number(old.version) !== b.version) v.fail('Someone updated this check-in. Reload it before editing again.', 409);
        await q(db, `INSERT INTO WellnessCheckInEdit(CheckInID,ChangedByID,ChangedAt,PreviousVersion,Snapshot)
          VALUES(?,?,?,?,?)`, [old.id,user.UserID,w.now,old.version,JSON.stringify(old)]);
        await q(db, `UPDATE WellnessCheckIn SET Feeling=?,SleepMinutes=?,SleepQuality=?,Mood=?,PainLevel=?,
          PainLocation=?,Notes=?,UpdatedByID=?,UpdatedAt=?,Version=Version+1 WHERE ID=? AND PatronID=?`,
        [b.feeling,b.sleepMinutes,b.sleepQuality,b.mood,b.painLevel,b.painLocation,b.notes,user.UserID,w.now,old.id,patron.id]);
        return { id: Number(old.id), message: 'Check-in updated.' };
      });
    },
    async remove(user, patronId, id, body) {
      const patron = await writable(user, patronId), expected = v.version(body), w = window();
      const result = await q(pool, `DELETE FROM WellnessCheckIn WHERE ID=? AND PatronID=? AND Version=?
        AND CheckInDate BETWEEN ? AND ?`, [v.number(id),patron.id,expected,w.oldestDate,w.today]);
      if (!result.affectedRows) v.fail('This check-in changed or was deleted. Reload the page.', 409);
      return { deleted: true };
    },
    async createRequest(user, patronId, body) {
      const patron = await writable(user, patronId), b = v.request(body), w = window();
      const result = await q(pool, `INSERT INTO WellnessAssistance
        (PatronID,RequestedByID,UpdatedByID,Category,Description,CreatedAt,UpdatedAt) VALUES(?,?,?,?,?,?,?)`,
      [patron.id,user.UserID,user.UserID,b.category,b.description,w.now,w.now]);
      return { id: Number(result.insertId), message: 'Request saved in the app. No notification was sent.' };
    },
    async updateRequest(user, patronId, id, body) {
      const patron = await writable(user, patronId), b = v.requestUpdate(body), w = window();
      const result = await q(pool, `UPDATE WellnessAssistance SET State=?,UpdatedByID=?,UpdatedAt=?,ResolvedAt=?,
        Version=Version+1 WHERE ID=? AND PatronID=? AND Version=? AND State<>'resolved'`,
      [b.state,user.UserID,w.now,b.state === 'resolved' ? w.now : null,v.number(id),patron.id,b.version]);
      if (!result.affectedRows) v.fail('This request changed or was resolved. Reload the page.', 409);
      return { updated: true };
    },
    async cleanup() {
      const w = window(); let checkIns = 0, assistance = 0;
      for (const [sql, args, key] of [
        ['DELETE FROM WellnessCheckIn WHERE CheckInDate<? LIMIT 500', [w.oldestDate], 'checkIns'],
        ["DELETE FROM WellnessAssistance WHERE State='resolved' AND ResolvedAt<? LIMIT 500", [w.resolvedCutoff], 'assistance'],
      ]) {
        for (let i = 0; i < 100; i++) {
          const result = await q(pool, sql, args);
          if (key === 'checkIns') checkIns += result.affectedRows; else assistance += result.affectedRows;
          if (result.affectedRows < 500) break;
        }
      }
      // An open request must not outlive the account it belongs to.
      let after = 0;
      for (let batch = 0; batch < 500; batch++) {
        const ids = (await q(pool, `SELECT PatronID id FROM (
          SELECT PatronID FROM WellnessCheckIn UNION SELECT PatronID FROM WellnessAssistance
          ) subjects WHERE PatronID>? ORDER BY PatronID LIMIT 500`, [after])).map(r => Number(r.id));
        if (!ids.length) break;
        const active = new Set((await q(accessPool, 'SELECT UserID id FROM UserMaster WHERE StatusID=1 AND UserID IN (?)', [ids])).map(r => Number(r.id)));
        const inactive = ids.filter(id => !active.has(id));
        if (inactive.length) {
          checkIns += (await q(pool, 'DELETE FROM WellnessCheckIn WHERE PatronID IN (?)', [inactive])).affectedRows;
          assistance += (await q(pool, 'DELETE FROM WellnessAssistance WHERE PatronID IN (?)', [inactive])).affectedRows;
        }
        after = ids.at(-1);
        if (ids.length < 500) break;
      }
      return { checkIns, assistance };
    },
  };
};
module.exports = { createWellnessService };
