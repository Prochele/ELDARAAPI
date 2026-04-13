const cron = require('node-cron');
const db = require('../config/db');
const { sendFCM } = require('../utils/fcm.util');

const groupByPatronAndTime = (rows) => {
  const map = {};

  rows.forEach(r => {
    const key = `${r.PatronId}_${r.IntakeTime}`;

    if (!map[key]) {
      map[key] = {
        patronId: r.PatronId,
        time: r.IntakeTime,
        medicines: []
      };
    }

    map[key].medicines.push({
      scheduleId: r.ScheduleId,
      medicineName: r.MedicineName,
      dosage: r.Dosage,
      intakeTypeId: r.IntakeTypeId
    });
  });

  return Object.values(map);
};

const startScheduler = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const [rows] = await db.query(`CALL sp_get_due_medicines()`);

      const data = rows[0] || [];
      console.log('Due medicines:', data);
      const grouped = groupByPatronAndTime(data);

      for (const g of grouped) {
        const [tokensResult] = await db.query(
          `CALL sp_get_push_tokens_by_patron(?)`,
          [g.patronId]
          
        );
     // console.log('Token result:', tokensResult);
        const tokens = (tokensResult[0] || []).map(t => t.PushToken);

        await sendFCM(tokens, g);
        console.log('Tokens:', tokens);
      }

    } catch (err) {
      console.error('Scheduler error:', err);
    }
  });
};

module.exports = { startScheduler };