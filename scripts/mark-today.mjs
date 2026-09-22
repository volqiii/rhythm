import { readFile, writeFile } from 'node:fs/promises';

const path = 'public/data/checkins.json';
const checkins = JSON.parse(await readFile(path, 'utf8'));
const timeZone = checkins.timeZone || 'Asia/Yekaterinburg';
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(new Date()).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
const today = `${parts.year}-${parts.month}-${parts.day}`;

function isoWeekNumber(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

if (process.argv.includes('--scheduled')) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date());
  const week = isoWeekNumber(Number(parts.year), Number(parts.month), Number(parts.day));
  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
  const isBiweeklySunday = weekday === 'Sun' && week % 2 === 0;
  if (!isWeekday && !isBiweeklySunday) {
    console.log(`No planned check-in for ${today}.`);
    process.exit(0);
  }
}

checkins.days = [...new Set(checkins.days || [])].sort();
if (checkins.days.includes(today)) {
  console.log(`Check-in for ${today} already exists.`);
  process.exit(0);
}

checkins.days.push(today);
checkins.updatedAt = new Date().toISOString();
await writeFile(path, `${JSON.stringify(checkins, null, 2)}\n`);
console.log(`Check-in added for ${today} (${timeZone}). Total: ${checkins.days.length}.`);

