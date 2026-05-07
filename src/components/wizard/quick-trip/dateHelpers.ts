// =============================================================
// Pure date helpers for the Quick Trip wizard
// =============================================================
// Extracted from Step 2 (When) so they're testable from ts-node
// without pulling in react-native imports. Local-timezone everywhere
// — toISOString would convert to UTC and shift days across boundaries.
// =============================================================

/** Format a Date as YYYY-MM-DD using LOCAL timezone. */
export function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromYMD(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

export function todayYMD(): string {
  return toYMD(new Date());
}

export function addDaysYMD(s: string, days: number): string {
  const d = fromYMD(s);
  if (!d) return s;
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

export function tomorrowYMD(): string {
  return addDaysYMD(todayYMD(), 1);
}

/** Next Saturday from today. If today IS Saturday, returns NEXT week's
 *  Saturday (skip 7 days) per spec. */
export function nextSaturdayYMD(): string {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilSat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilSat);
  return toYMD(d);
}

export function formatLongDate(s: string): string {
  const d = fromYMD(s);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function daysBetweenYMD(start: string, end: string): number {
  const a = fromYMD(start);
  const b = fromYMD(end);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function countdownLabel(s: string): string {
  const days = daysBetweenYMD(todayYMD(), s);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  if (days < 0) return `${Math.abs(days)} DAYS AGO`;
  return `T−${days} DAYS`;
}
