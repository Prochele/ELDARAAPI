const db = require('../config/db');
const { number, fail, indiaDate } = require('../utils/careWorkflow');
const assertPatronAccess = async (pool, user, patronId) => {
  const id = number(patronId),
    uid = number(user.UserID);
  const [rows] = await pool.query(
    `SELECT P.UserID FROM UserMaster P WHERE P.UserID=? AND P.StatusID=1 AND (
    (? IN ('PT','PTA') AND P.UserID=?) OR
    (?='PTA' AND EXISTS(SELECT 1 FROM UserMaster U WHERE U.UserID=? AND U.MemberGroupID=P.MemberGroupID)) OR
    (?='CT' AND EXISTS(SELECT 1 FROM CareAssignment A WHERE A.PatronID=P.UserID AND A.CaretakerID=?
      AND A.State='active' AND A.FromDate<=? AND (A.ToDate IS NULL OR A.ToDate>=?))))`,
    [id, user.RoleCode, uid, user.RoleCode, uid, user.RoleCode, uid, indiaDate(), indiaDate()]
  );
  if (!rows.length) fail('You do not have access to this patron', 403);
  return id;
};
const guard = (resolve) => async (req, res, next) => {
  try {
    const patronId = await resolve(req, db);
    await assertPatronAccess(db, req.user, patronId);
    next();
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, message: e.message });
    next(e);
  }
};
const resource = (table, key, id) => async (req, pool) => {
  const [rows] = await pool.query(`SELECT PatronId FROM ${table} WHERE ${key}=?`, [
    number(id(req)),
  ]);
  if (!rows.length) fail('Record not found', 404);
  return rows[0].PatronId;
};
const fileTarget = async (req, pool) => {
  if (req.params.file_id) {
    const [medicine] = await pool.query('SELECT PatronId FROM MedicineMaster WHERE FileId=?', [
      number(req.params.file_id),
    ]);
    if (medicine.length) return medicine[0].PatronId;
    const [files] = await pool.query(
      'SELECT entity_type,entity_id FROM filestorage WHERE file_id=? AND is_deleted=0',
      [number(req.params.file_id)]
    );
    if (!files.length) fail('File not found', 404);
    if (files[0].entity_type !== 'pta') fail('Unsupported care file', 403);
    return files[0].entity_id;
  }
  if (req.body.entity_type !== 'pta') fail('Unsupported care file', 403);
  return req.body.entity_id;
};
module.exports = { assertPatronAccess, guard, resource, fileTarget };
