import { readFile, writeFile } from 'node:fs/promises';

const path = 'public/data/checkins.json';
const checkins = JSON.parse(await readFile(path, 'utf8'));
const config = JSON.parse(await readFile('rhythm.config.json', 'utf8'));
const timeZone = config.timeZone || 'Asia/Yekaterinburg';
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(new Date()).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
const today = `${parts.year}-${parts.month}-${parts.day}`;

function level(value) {
  return Math.min(20, Math.max(0, Math.floor(Number(value) || 0)));
}

function isoWeekNumber(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date());
const week = isoWeekNumber(Number(parts.year), Number(parts.month), Number(parts.day));
const weekdayNumber = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
const activeWeekdays = Array.isArray(config.activeWeekdays) ? config.activeWeekdays : [];
const isActiveWeekday = activeWeekdays.includes(weekdayNumber);
const isBiweeklySunday = Boolean(config.biweeklySunday) && weekday === 'Sun' && week % 2 === 0;
const overrides = config.dateLevels && typeof config.dateLevels === 'object' ? config.dateLevels : {};
const plannedLevel = Object.hasOwn(overrides, today)
  ? level(overrides[today])
  : (isActiveWeekday || isBiweeklySunday ? level(config.defaultLevel ?? 1) : 0);

if (process.argv.includes('--print-level')) {
  console.log(plannedLevel);
  process.exit(0);
}

if (process.argv.includes('--scheduled') && plannedLevel === 0) {
  console.log(`No planned check-in for ${today}.`);
  process.exit(0);
}

checkins.entries = Array.isArray(checkins.entries) ? checkins.entries : [...new Set(checkins.days || [])].map((date) => ({ date }));
const completed = checkins.entries.filter((entry) => entry.date === today).length;
if (completed >= plannedLevel) {
  console.log(`The planned level for ${today} is already complete.`);
  process.exit(0);
}

checkins.entries.push({ date: today, number: completed + 1, recordedAt: new Date().toISOString() });
delete checkins.days;
checkins.updatedAt = new Date().toISOString();
await writeFile(path, `${JSON.stringify(checkins, null, 2)}\n`);
console.log(`Check-in ${completed + 1}/${plannedLevel} added for ${today} (${timeZone}).`);

