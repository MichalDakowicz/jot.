const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "just now" / "2h ago" / "yesterday" / "4 days ago" / "1 week ago" */
export function relative(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const d = Math.max(0, now - then);
  if (d < 2 * MIN) return 'just now';
  if (d < HOUR) return Math.floor(d / MIN) + 'm ago';
  if (d < DAY) return Math.floor(d / HOUR) + 'h ago';
  const days = Math.floor(d / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return days + ' days ago';
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : weeks + ' weeks ago';
  const months = Math.floor(days / 30);
  return months <= 1 ? '1 month ago' : months + ' months ago';
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function todayLabel(d = new Date()): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

/** "09:00:00" -> "9:00" */
export function clock(t: string): string {
  const [h, m] = t.split(':');
  return `${Number(h)}:${m}`;
}

export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function spelled(n: number): string {
  return ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] ?? String(n);
}
