const { createHash } = require('node:crypto');

const buildScheduleMessage = (device, reminder, now = Date.now()) => {
  const groupId = `eldara-schedule-${reminder.recipientId}-${reminder.date}`;
  const data = {
    type: reminder.type, title: reminder.title, body: reminder.body,
    reminderId: reminder.id, recipientId: reminder.recipientId,
    sourceId: reminder.sourceId, scheduleDate: reminder.date, eventTime: reminder.time,
    expiresAt: String(reminder.expiresAt), groupId,
  };
  const message = { token: device.PushToken, data };
  if (device.Platform === 'IOS') {
    // An APNs alert is visible even when iOS does not start the JS background handler.
    message.apns = {
      headers: { 'apns-priority': '10', 'apns-push-type': 'alert',
        'apns-collapse-id': createHash('sha256').update(reminder.id).digest('hex'),
        'apns-expiration': String(Math.floor(reminder.expiresAt / 1000)) },
      payload: { aps: {
        alert: { title: reminder.title, body: reminder.body },
        sound: 'default', threadId: groupId,
      } },
    };
  } else {
    // Data-only on Android: Notifee owns display/grouping and prevents a second OS notification.
    message.android = { priority: 'high', ttl: Math.max(0, reminder.expiresAt - now) };
  }
  return message;
};

module.exports = { buildScheduleMessage };
