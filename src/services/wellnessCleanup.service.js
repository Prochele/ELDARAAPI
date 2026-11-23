const startWellnessCleanup = (service) => {
  const run = () => service.cleanup().catch(error => console.error('Wellness cleanup failed', { code: error.code }));
  const task = require('node-cron').schedule('0 0 * * *', run, { timezone: 'Asia/Kolkata', noOverlap: true });
  void run();
  return task;
};
module.exports = { startWellnessCleanup };
