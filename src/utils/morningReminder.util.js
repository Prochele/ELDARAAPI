const TIME_ZONE = 'Asia/Kolkata';
const TYPES = { APPOINTMENT: 'DOCTOR_APPOINTMENT', ACTIVITY: 'DAILY_ACTIVITY' };

const getIndiaClock = (now = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    afterMorning: Number(parts.hour) >= 8,
  };
};

const formatReminderTime = (time) => {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(time));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(String(time).split(':')[2] || 0) > 59) {
    throw new Error('Invalid reminder time');
  }
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`;
};

const buildReminder = (event, now = new Date()) => {
  const clock = getIndiaClock(now);
  if (!clock.afterMorning || event.ScheduleDate !== clock.date) {
    return null;
  }
  const appointment = event.ReminderType === TYPES.APPOINTMENT;
  if (!appointment && event.ReminderType !== TYPES.ACTIVITY) throw new Error('Unknown reminder type');
  const time = formatReminderTime(event.EventTime);
  // A short preview leaves room for both APNs alert and FCM data within the payload limit.
  const characters = Array.from(String(event.Description).trim());
  const description = characters.length > 200 ? `${characters.slice(0, 200).join('')}...` : characters.join('');
  const doctor = description.replace(/^Dr\.?\s+/i, '');
  const body = appointment
    ? `Doctor's appointment today with Dr. ${doctor} at ${time}`
    : `${description} today at ${time}`;
  const expiresAt = new Date(`${event.ScheduleDate}T${event.EventTime}+05:30`).getTime() + 60000;
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return null;
  return {
    id: `schedule-${event.RecipientID}-${event.ScheduleDate}-${event.ReminderType}-${event.SourceID}`,
    type: event.ReminderType,
    recipientId: String(event.RecipientID),
    sourceId: String(event.SourceID),
    date: event.ScheduleDate,
    time: event.EventTime,
    title: appointment ? 'Doctor Appointment' : 'Daily Activity',
    body,
    expiresAt,
  };
};

module.exports = { TIME_ZONE, TYPES, getIndiaClock, formatReminderTime, buildReminder };
