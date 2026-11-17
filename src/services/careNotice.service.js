// Separate worker and notification type. Existing medicine/morning jobs are untouched.
const createCareNoticeWorker = (pool, send) => {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      const db = await pool.getConnection();
      let notices;
      try {
        await db.beginTransaction();
        [notices] = await db.query(`SELECT ID,RecipientID,Target,ReferenceID FROM CareNotice
          WHERE SentAt IS NULL AND Attempts<5 AND NextAttemptAt<=UTC_TIMESTAMP()
          AND CreatedAt>=UTC_TIMESTAMP()-INTERVAL 1 DAY ORDER BY ID LIMIT 25 FOR UPDATE SKIP LOCKED`);
        for (const n of notices)
          await db.query(
            'UPDATE CareNotice SET Attempts=Attempts+1,NextAttemptAt=UTC_TIMESTAMP()+INTERVAL 2 MINUTE WHERE ID=?',
            [n.ID]
          );
        await db.commit();
      } catch (e) {
        await db.rollback();
        throw e;
      } finally {
        db.release();
      }
      for (const n of notices) {
        try {
          // Bind device ownership to the registering session, preventing cross-account alerts.
          const [devices] = await pool.query(
            `SELECT DISTINCT D.PushToken,D.Platform,D.AppVersion FROM UserDeviceInfo D
            JOIN UserMaster U ON U.UserID=D.UserID AND U.StatusID=1
            JOIN ScheduleReminderDevices R ON R.UserID=D.UserID AND R.DeviceUUID=D.DeviceUUID AND R.PushTokenHash=SHA2(D.PushToken,256)
            WHERE D.UserID=? AND D.PushToken IS NOT NULL AND D.Platform IN('ANDROID','IOS')
            AND EXISTS(SELECT 1 FROM UserTokens T WHERE T.UserID=D.UserID AND T.IsActive=1 AND SHA2(T.AccessToken,256)=R.SessionTokenHash)`,
            [n.RecipientID]
          );
          // The persisted inbox is authoritative even when push is disabled/unavailable.
          for (const device of devices) {
            const parts = String(device.AppVersion || '')
              .split('.')
              .map(Number);
            if (
              parts.length !== 3 ||
              parts.some((x) => !Number.isInteger(x)) ||
              parts[0] * 1000000 + parts[1] * 1000 + parts[2] < 1009007
            )
              continue;
            await send(device, n);
          }
          await pool.query('UPDATE CareNotice SET SentAt=UTC_TIMESTAMP() WHERE ID=?', [n.ID]);
        } catch (e) {
          console.warn('Caretaker notification will retry', {
            noticeId: n.ID,
            code: e.code || 'send-failed',
          });
        }
      }
    } finally {
      running = false;
    }
  };
};
const startCareNoticeWorker = () => {
  const worker = createCareNoticeWorker(
    require('../config/db'),
    require('../utils/fcm.util').sendCareFCM
  );
  const tick = () =>
    worker().catch((e) =>
      console.warn('Caretaker notification worker unavailable', { code: e.code || 'worker-failed' })
    );
  const timer = setInterval(tick, 30000);
  timer.unref();
  tick();
  return timer;
};
module.exports = { createCareNoticeWorker, startCareNoticeWorker };
