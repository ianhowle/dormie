/**
 * Time-based and contextual greetings.
 * Makes the app feel alive and personal.
 */

/** Masters Tournament dates (approximate — update yearly) */
const MASTERS_DATES: [number, number, number, number][] = [
  // [month (0-indexed), startDay, endDay, year]
  [3, 7, 13, 2025], // April 7–13, 2025
  [3, 6, 12, 2026], // April 6–12, 2026
  [3, 5, 11, 2027], // April 5–11, 2027
];

function isMastersWeek(): boolean {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const year = now.getFullYear();

  return MASTERS_DATES.some(
    ([m, start, end, y]) => year === y && month === m && day >= start && day <= end,
  );
}

function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function getDayName(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function getGreeting(firstName?: string): string {
  const name = firstName ?? 'golfer';
  const time = getTimeOfDay();

  // Special: Masters week
  if (isMastersWeek()) {
    return `It's Masters week, ${name}`;
  }

  // Special: Weekend
  if (isWeekend()) {
    const day = getDayName();
    return `Happy ${day}, ${name} — perfect day for a round`;
  }

  // Standard time-based
  return `Good ${time}, ${name}`;
}

export function getGreetingSubtitle(): string | null {
  if (isMastersWeek()) {
    return 'A tradition unlike any other';
  }
  return null;
}

/** Whether the header should have gold tint (Masters week) */
export function isMastersTheme(): boolean {
  return isMastersWeek();
}
