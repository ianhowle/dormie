// ─── Types ───────────────────────────────────────────────────────────
export type FeedItem = {
  id: string;
  type: 'round_posted' | 'trip_created' | 'season_update' | 'achievement';
  playerId: string;
  playerName: string;
  description: string;
  timestamp: string; // ISO date-time
};

export type QuickStats = {
  handicap: number;
  monthRounds: number;
  bestRecent: number;
  streak: number | string; // consecutive weeks played
};

export type UpcomingItem = {
  id: string;
  type: 'trip' | 'season';
  title: string;
  subtitle: string;
  daysAway: number;
};

// ─── Mock data ───────────────────────────────────────────────────────
export const MOCK_QUICK_STATS: QuickStats = {
  handicap: 8.2,
  monthRounds: 6,
  bestRecent: 71,
  streak: 4,
};

export const MOCK_FEED: FeedItem[] = [
  {
    id: 'f1',
    type: 'round_posted',
    playerId: '2',
    playerName: 'Tommy Fleetwood',
    description: 'posted 68 at Hermitage Golf Course',
    timestamp: '2026-03-13T09:30:00',
  },
  {
    id: 'f2',
    type: 'trip_created',
    playerId: '4',
    playerName: 'Drew Patterson',
    description: 'started a new trip: Scottsdale 2026',
    timestamp: '2026-03-12T16:45:00',
  },
  {
    id: 'f3',
    type: 'season_update',
    playerId: '1',
    playerName: 'Ian McGowan',
    description: 'Your season standings: #2 in Spring Championship',
    timestamp: '2026-03-12T08:00:00',
  },
  {
    id: 'f4',
    type: 'round_posted',
    playerId: '6',
    playerName: 'Nate Harmon',
    description: 'posted 77 at Nashville Golf & Athletic',
    timestamp: '2026-03-11T14:20:00',
  },
  {
    id: 'f5',
    type: 'achievement',
    playerId: '3',
    playerName: 'Jake Sullivan',
    description: 'set a new personal best: 75 at Greystone',
    timestamp: '2026-03-10T11:15:00',
  },
  {
    id: 'f6',
    type: 'round_posted',
    playerId: '8',
    playerName: 'Ryan Kessler',
    description: 'posted 78 at Gaylord Springs',
    timestamp: '2026-03-09T17:00:00',
  },
];

export const MOCK_UPCOMING: UpcomingItem[] = [
  {
    id: 'u1',
    type: 'trip',
    title: 'Scottsdale 2026',
    subtitle: '4 players · 3 rounds planned',
    daysAway: 12,
  },
  {
    id: 'u2',
    type: 'season',
    title: 'Spring Championship — Week 10',
    subtitle: 'You\'re #2 of 8 players',
    daysAway: 4,
  },
];
