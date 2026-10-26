const { getIndiaClock, buildReminder } = require('../utils/morningReminder.util');

const PERMANENT_ERRORS = new Set([
  'messaging/registration-token-not-registered', 'messaging/invalid-registration-token',
]);

const createMorningReminderRunner = ({ repository, send, logger = console, clock = () => new Date() }) => {
  let running = false;
  return async () => {
    if (running) return;
    const now = clock();
    const local = getIndiaClock(now);
    if (!local.afterMorning) return;
    running = true;
    try {
      const events = await repository.findEvents(local.date, `${local.time.slice(0, 5)}:00`);
      const devicesByUser = new Map();
      for (const event of events) {
        let reminder;
        try {
          reminder = buildReminder(event, clock());
        } catch {
          logger.warn('Invalid morning reminder event skipped');
          continue;
        }
        if (!reminder) continue;
        if (!devicesByUser.has(event.RecipientID)) {
          devicesByUser.set(event.RecipientID, await repository.findDevices(event.RecipientID));
        }
        const seenTokens = new Set();
        for (const device of devicesByUser.get(event.RecipientID)) {
          if (seenTokens.has(device.PushToken)) continue;
          seenTokens.add(device.PushToken);
          const claim = await repository.claim(event, device);
          if (!claim) continue;
          try {
            if (reminder.expiresAt <= clock().getTime()) {
              await repository.fail(claim, 'event-expired', true);
              continue;
            }
            await send(device, reminder);
            await repository.complete(claim);
          } catch (error) {
            await repository.fail(claim, error.code, PERMANENT_ERRORS.has(error.code));
            logger.warn('Morning reminder delivery failed', { code: error.code || 'send-failed' });
          }
        }
      }
    } catch (error) {
      logger.error('Morning reminder job failed', { code: error.code || 'job-failed' });
    } finally {
      running = false;
    }
  };
};

module.exports = { createMorningReminderRunner };
