const express = require('express');
const db = require('../config/db');
const v = require('../utils/careWorkflow');
const admin = require('../middlewares/admin.middleware');
const { audit } = require('../repositories/admin.repository');
const router = express.Router();
router.use(admin);
const handle = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, message: e.message });
    next(e);
  }
};
router.get(
  '/',
  handle(async (r) => {
    const search = v.text(r.query.search || '', 100, true);
    const [rows] = await db.query(
      `SELECT R.ID,R.ContactID,R.ReporterID,R.Reason,R.State,
    DATE_FORMAT(R.CreatedAt,'%d-%m-%Y %H:%i UTC') CreatedAt,
    CONCAT_WS(' ',U.FirstName,U.LastName) ReporterName
    FROM CareReport R JOIN UserMaster U ON U.UserID=R.ReporterID
    WHERE (?='' OR R.Reason LIKE ? OR U.FirstName LIKE ?) ORDER BY R.State,R.ID DESC LIMIT 200`,
      [search, '%' + search + '%', '%' + search + '%']
    );
    return rows;
  })
);
router.get(
  '/:id',
  handle(async (r) => {
    const [reports] = await db.query(
      `SELECT R.*,C.Introduction,C.State ContactState,C.PTAID,C.CaretakerID,
    CONCAT_WS(' ',P.FirstName,P.LastName) PTAName,CONCAT_WS(' ',T.FirstName,T.LastName) CaretakerName
    FROM CareReport R JOIN CareContact C ON C.ID=R.ContactID JOIN UserMaster P ON P.UserID=C.PTAID
    JOIN UserMaster T ON T.UserID=C.CaretakerID WHERE R.ID=?`,
      [v.number(r.params.id)]
    );
    if (!reports.length) v.fail('Report not found', 404);
    const before = r.query.before ? v.number(r.query.before) : Number.MAX_SAFE_INTEGER;
    const [messages] = await db.query(
      `SELECT ID,SenderID,Body,DATE_FORMAT(CreatedAt,'%d-%m-%Y %H:%i UTC') CreatedAt
    FROM CareMessage WHERE ContactID=? AND ID<? ORDER BY ID DESC LIMIT 101`,
      [reports[0].ContactID, before]
    );
    await audit({
      adminUserId: r.admin.AdminUserID,
      action: 'VIEW_REPORTED_CONVERSATION',
      entityType: 'CareReport',
      entityId: r.params.id,
      ipAddress: r.ip,
    });
    return {
      report: reports[0],
      messages: messages.slice(0, 100).reverse(),
      hasMore: messages.length > 100,
    };
  })
);
router.put(
  '/:id/reviewed',
  handle(async (r) => {
    const id = v.number(r.params.id);
    const [result] = await db.query(
      "UPDATE CareReport SET State='reviewed',ReviewedAt=UTC_TIMESTAMP(),ReviewedBy=? WHERE ID=?",
      [r.admin.AdminUserID, id]
    );
    if (!result.affectedRows) v.fail('Report not found', 404);
    await audit({
      adminUserId: r.admin.AdminUserID,
      action: 'REVIEW_CARE_REPORT',
      entityType: 'CareReport',
      entityId: id,
      newValue: { state: 'reviewed' },
      ipAddress: r.ip,
    });
    return { saved: true };
  })
);
module.exports = router;
