const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const number = (value, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    (typeof value === 'string' && !value.trim())
  )
    fail('Invalid numeric value');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail('Invalid numeric value');
  return n;
};
const text = (value, max, optional = false) => {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string') fail('Text is required');
  const s = value.trim();
  if ((!s && !optional) || s.length > max)
    fail(`Text must contain ${optional ? '0' : '1'}–${max} characters`);
  return s;
};
const date = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail('Use a valid calendar date');
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    fail('Invalid calendar date');
  return value;
};
const indiaDate = (now = Date.now()) => new Date(now + 19800000).toISOString().slice(0, 10);
const minutes = (value) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('Use HH:mm time');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
};
const days = (value) => {
  if (!Array.isArray(value) || !value.length || value.length > 7) fail('Choose working days');
  return [...new Set(value.map((v) => number(v, 0, 6)))].sort();
};
const weekday = (value) => new Date(`${value}T00:00:00Z`).getUTCDay();
const plusDays = (value, n) =>
  new Date(new Date(`${value}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const normalizeAssignment = (body) => {
  const kind = body.kind;
  if (!['once', 'weekly'].includes(kind)) fail('Choose one day or recurring weekly');
  if (!['full-time', 'part-time'].includes(body.workType)) fail('Choose full-time or part-time');
  const fromDate = date(body.fromDate),
    toDate = kind === 'once' ? fromDate : body.toDate ? date(body.toDate) : null;
  if (fromDate < indiaDate() || (toDate && toDate < fromDate))
    fail('Assignment dates must start today or later and end after the start');
  const fromMinute = minutes(body.fromTime),
    toMinute = minutes(body.toTime);
  if (toMinute <= fromMinute)
    fail('End time must follow start time; overnight work is not supported');
  const weekdays = kind === 'once' ? [weekday(fromDate)] : days(body.weekdays);
  if (
    toDate &&
    !weekdays.some((day) => {
      const first = plusDays(fromDate, (day - weekday(fromDate) + 7) % 7);
      return first <= toDate;
    })
  )
    fail('No selected working day falls within these dates');
  return {
    patronId: number(body.patronId),
    caretakerId: number(body.caretakerId),
    kind,
    workType: body.workType,
    fromDate,
    toDate,
    weekdays,
    fromMinute,
    toMinute,
    notes: text(body.notes, 1000, true),
  };
};
const normalizeSlots = (slots) => {
  if (!Array.isArray(slots) || slots.length > 28) fail('Choose up to 28 weekly time ranges');
  const result = slots.map((s) => ({
    weekday: number(s.weekday, 0, 6),
    fromMinute: minutes(s.from),
    toMinute: minutes(s.to),
  }));
  result.forEach((a, i) => {
    if (a.toMinute <= a.fromMinute) fail('Availability end must follow start');
    if (
      result.some(
        (b, j) =>
          i !== j &&
          a.weekday === b.weekday &&
          a.fromMinute < b.toMinute &&
          b.fromMinute < a.toMinute
      )
    )
      fail('Availability ranges overlap');
  });
  return result;
};
const unpack = (a) => ({
  ...a,
  weekdays: typeof a.weekdays === 'string' ? JSON.parse(a.weekdays) : a.weekdays,
});
const hasOccurrence = (a, from, to) =>
  a.weekdays.some((day) => plusDays(from, (day - weekday(from) + 7) % 7) <= to);
const overlaps = (a, b) => {
  a = unpack(a);
  b = unpack(b);
  const from = [a.fromDate, b.fromDate].sort().at(-1),
    to = [a.toDate || '9999-12-31', b.toDate || '9999-12-31'].sort()[0];
  if (from > to) return false;
  if (a.kind === 'legacy' || b.kind === 'legacy') return true;
  return (
    a.fromMinute < b.toMinute &&
    b.fromMinute < a.toMinute &&
    hasOccurrence({ ...a, weekdays: a.weekdays.filter((d) => b.weekdays.includes(d)) }, from, to)
  );
};
const fitsAvailability = (a, slots, leaves) =>
  a.weekdays.every((day) =>
    slots.some((s) => s.weekday === day && s.fromMinute <= a.fromMinute && s.toMinute >= a.toMinute)
  ) &&
  !leaves.some((l) => {
    const from = [a.fromDate, l.fromDate].sort().at(-1),
      to = [a.toDate || '9999-12-31', l.toDate].sort()[0];
    return from <= to && hasOccurrence(a, from, to);
  });
const freeSlots = (slots, assignments, onDate = indiaDate()) =>
  slots.flatMap((slot) => {
    let ranges = [[slot.fromMinute, slot.toMinute]];
    assignments
      .map(unpack)
      .filter((a) => a.fromDate <= onDate && (!a.toDate || a.toDate >= onDate))
      .forEach((a) => {
        if (a.kind === 'legacy') {
          ranges = [];
          return;
        }
        if (!a.weekdays.includes(slot.weekday)) return;
        ranges = ranges.flatMap(([f, t]) =>
          a.fromMinute >= t || a.toMinute <= f
            ? [[f, t]]
            : [
                [f, Math.max(f, a.fromMinute)],
                [Math.min(t, a.toMinute), t],
              ].filter(([x, y]) => x < y)
        );
      });
    return ranges.map(([fromMinute, toMinute]) => ({
      weekday: slot.weekday,
      fromMinute,
      toMinute,
    }));
  });
module.exports = {
  fail,
  number,
  text,
  date,
  indiaDate,
  minutes,
  days,
  normalizeAssignment,
  normalizeSlots,
  overlaps,
  fitsAvailability,
  freeSlots,
};
