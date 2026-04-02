// ─── Types ───────────────────────────────────────────────────────────
export type TripStatus = 'planning' | 'upcoming' | 'active' | 'completed';

export type Trip = {
  id: string;
  name: string;
  destination: string;
  city: string;
  state: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  inviteCode: string;
  isRyderCup: boolean;
  createdBy: string;
  playerIds: string[];
  roundsPlanned: number;
  gradient: [string, string];
  champion?: string; // only for completed
  competitionStarted?: boolean; // true when trip competition is live
};

export type TripMember = {
  id: string;
  tripId: string;
  userId: string;
  role: 'organizer' | 'captain' | 'player';
  team?: 'usa' | 'europe';
};

export type TripStats = {
  totalTrips: number;
  wins: number;
  tripAvg: number;
  regularAvg: number;
};

export type DreamDestination = {
  id: string;
  name: string;
  city: string;
  state: string;
  gradient: [string, string];
};

export type BucketCourse = {
  id: string;
  name: string;
  city: string;
  state: string;
};

export type ExploreDestination = {
  id: string;
  name: string;
  tagline: string;
  gradient: [string, string];
};

// ─── Helpers ──────────────────────────────────────────────────────────
export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function getDaysUntilTrip(startDate: string): number {
  const diff = new Date(startDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Mock data ───────────────────────────────────────────────────────
export const MOCK_TRIP_STATS: TripStats = {
  totalTrips: 7,
  wins: 3,
  tripAvg: 76.8,
  regularAvg: 79.2,
};

export const MOCK_UPCOMING_TRIPS: Trip[] = [
  {
    id: 't1',
    name: 'Scottsdale 2026',
    destination: 'TPC Scottsdale',
    city: 'Scottsdale',
    state: 'AZ',
    startDate: '2026-03-26',
    endDate: '2026-03-29',
    status: 'upcoming',
    inviteCode: 'SCOT26',
    isRyderCup: false,
    createdBy: '4',
    playerIds: ['1', '2', '4', '6'],
    roundsPlanned: 3,
    gradient: ['#8B6B3A', '#C4994A'],
  },
  {
    id: 't2',
    name: 'The McGowan Cup',
    destination: 'Hermitage Golf Course',
    city: 'Old Hickory',
    state: 'TN',
    startDate: '2026-04-18',
    endDate: '2026-04-20',
    status: 'upcoming',
    inviteCode: 'MCGWN',
    isRyderCup: true,
    createdBy: '1',
    playerIds: ['1', '2', '3', '4', '5', '6', '7', '8'],
    roundsPlanned: 4,
    gradient: ['#1565C0', '#B71C1C'],
  },
];

export const MOCK_COMPLETED_TRIPS: Trip[] = [
  {
    id: 't3',
    name: 'Myrtle Beach 2025',
    destination: 'TPC Myrtle Beach',
    city: 'Myrtle Beach',
    state: 'SC',
    startDate: '2025-10-10',
    endDate: '2025-10-13',
    status: 'completed',
    inviteCode: 'MYRTL',
    isRyderCup: false,
    createdBy: '1',
    playerIds: ['1', '2', '3', '4', '6'],
    roundsPlanned: 3,
    gradient: ['#2A4A6B', '#5B7FA5'],
    champion: 'Tommy Fleetwood',
  },
];

export const MOCK_DREAM_DESTINATIONS: DreamDestination[] = [
  { id: 'd1', name: 'Pebble Beach', city: 'Pebble Beach', state: 'CA', gradient: ['#0A3D6B', '#1E6B4A'] },
  { id: 'd2', name: 'Bandon Dunes', city: 'Bandon', state: 'OR', gradient: ['#1A4D2B', '#8B7B4A'] },
  { id: 'd3', name: 'Pinehurst No. 2', city: 'Pinehurst', state: 'NC', gradient: ['#6B3A1A', '#2D5A2D'] },
];

export const MOCK_BUCKET_COURSES: BucketCourse[] = [
  { id: 'bl1', name: 'Pebble Beach Golf Links', city: 'Pebble Beach', state: 'CA' },
  { id: 'bl2', name: 'St Andrews Old Course', city: 'St Andrews', state: 'Scotland' },
  { id: 'bl3', name: 'Bandon Dunes', city: 'Bandon', state: 'OR' },
];

export const MOCK_EXPLORE_DESTINATIONS: ExploreDestination[] = [
  { id: 'e1', name: 'Scottsdale', tagline: '12 courses nearby', gradient: ['#C4601A', '#E8944A'] },
  { id: 'e2', name: 'Hilton Head', tagline: '8 courses nearby', gradient: ['#1A6B5A', '#3A9B7A'] },
  { id: 'e3', name: 'Palm Springs', tagline: '15 courses nearby', gradient: ['#8B6B0A', '#D4A83A'] },
  { id: 'e4', name: 'Austin', tagline: '6 courses nearby', gradient: ['#5A2A0A', '#A0603A'] },
];
