/**
 * PGA Tour major event calendar.
 * Update each January for that year's specific dates.
 * TODO: fetch from a golf schedule API if available.
 */

export type EventType = 'major' | 'signature' | 'playoff' | 'team';

export type GolfEvent = {
  name: string;
  startMonth: number; // 1-indexed (1 = January)
  startDay: number;
  endMonth: number;
  endDay: number;
  type: EventType;
  /** Optional accent override */
  accent?: string;
};

/** 2026 PGA Tour calendar — update yearly */
export const GOLF_CALENDAR: GolfEvent[] = [
  // Signature events
  { name: 'Arnold Palmer Invitational', startMonth: 3, startDay: 4, endMonth: 3, endDay: 7, type: 'signature' },
  { name: 'The Players Championship', startMonth: 3, startDay: 11, endMonth: 3, endDay: 14, type: 'signature' },
  { name: 'Memorial Tournament', startMonth: 6, startDay: 5, endMonth: 6, endDay: 8, type: 'signature' },

  // Majors
  { name: 'The Masters', startMonth: 4, startDay: 7, endMonth: 4, endDay: 13, type: 'major', accent: '#C9A227' },
  { name: 'PGA Championship', startMonth: 5, startDay: 15, endMonth: 5, endDay: 18, type: 'major' },
  { name: 'US Open', startMonth: 6, startDay: 12, endMonth: 6, endDay: 15, type: 'major' },
  { name: 'The Open Championship', startMonth: 7, startDay: 17, endMonth: 7, endDay: 20, type: 'major' },

  // FedEx Cup Playoffs
  { name: 'FedEx St. Jude Championship', startMonth: 8, startDay: 14, endMonth: 8, endDay: 17, type: 'playoff' },
  { name: 'BMW Championship', startMonth: 8, startDay: 21, endMonth: 8, endDay: 24, type: 'playoff' },
  { name: 'Tour Championship', startMonth: 8, startDay: 28, endMonth: 8, endDay: 31, type: 'playoff' },

  // Team events — Ryder Cup odd years, Presidents Cup even years
  { name: 'Presidents Cup', startMonth: 9, startDay: 22, endMonth: 9, endDay: 27, type: 'team', accent: '#C41E3A' },
];

export type ActiveEvent = {
  event: GolfEvent;
  label: string;
  subtitle: string | null;
  accentColor: string | null;
  isGoldHeader: boolean;
  isPlayoffs: boolean;
};

/**
 * Check if a date falls within any PGA Tour event window.
 * Returns the active event info, or null if no event is happening.
 */
export function getActiveEvent(date: Date = new Date()): ActiveEvent | null {
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  const event = GOLF_CALENDAR.find((e) => {
    if (e.startMonth === e.endMonth) {
      return month === e.startMonth && day >= e.startDay && day <= e.endDay;
    }
    // Cross-month event (unlikely but handle it)
    if (month === e.startMonth && day >= e.startDay) return true;
    if (month === e.endMonth && day <= e.endDay) return true;
    return false;
  });

  if (!event) return null;

  const isMasters = event.name === 'The Masters';
  const isTeam = event.type === 'team';
  const isPlayoff = event.type === 'playoff';
  const isMajor = event.type === 'major';

  let label: string;
  let subtitle: string | null = null;
  let accentColor: string | null = null;
  let isGoldHeader = false;

  if (isMasters) {
    label = "It's Masters Week \uD83C\uDF3A";
    subtitle = 'A tradition unlike any other';
    accentColor = '#C9A227';
    isGoldHeader = true;
  } else if (isMajor) {
    label = `It's ${event.name} Week \u26F3`;
    accentColor = event.accent ?? null;
  } else if (isTeam) {
    const isRyder = event.name.includes('Ryder');
    label = isRyder ? '\uD83C\uDDFA\uD83C\uDDF8 Ryder Cup Week' : '\uD83C\uDDFA\uD83C\uDDF8 Presidents Cup Week';
    accentColor = '#C41E3A';
  } else if (isPlayoff) {
    label = 'FedEx Cup Playoffs';
    accentColor = '#C9A227';
    isGoldHeader = true;
  } else {
    // Signature event
    label = `${event.name} This Week`;
  }

  return {
    event,
    label,
    subtitle,
    accentColor,
    isGoldHeader,
    isPlayoffs: isPlayoff,
  };
}
