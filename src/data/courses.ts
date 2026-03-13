export type PlayedCourse = {
  id: string;
  name: string;
  city: string;
  state: string;
  par: number;
  slope: number;
  totalRounds: number;
  playerCount: number;
  myBest: number | null; // null if user hasn't played
  recordScore: number | null; // null if no record
  recordHolder: string | null;
  gradient: [string, string];
};

export type CommunityCourse = {
  id: string;
  name: string;
  city: string;
  state: string;
  communityRounds: number;
  communityAvg: number;
};

// ─── Tier 1: Played by group ────────────────────────────────────────
export const MOCK_PLAYED_COURSES: PlayedCourse[] = [
  {
    id: 'c1',
    name: 'Hermitage Golf Course',
    city: 'Old Hickory',
    state: 'TN',
    par: 72,
    slope: 131,
    totalRounds: 34,
    playerCount: 7,
    myBest: 74,
    recordScore: 68,
    recordHolder: 'Tommy Fleetwood',
    gradient: ['#1E4D2B', '#2D6A3F'],
  },
  {
    id: 'c2',
    name: 'Gaylord Springs',
    city: 'Nashville',
    state: 'TN',
    par: 72,
    slope: 135,
    totalRounds: 28,
    playerCount: 6,
    myBest: 76,
    recordScore: 71,
    recordHolder: 'Drew Patterson',
    gradient: ['#2A4A6B', '#5B7FA5'],
  },
  {
    id: 'c3',
    name: 'Nashville Golf & Athletic',
    city: 'Nashville',
    state: 'TN',
    par: 72,
    slope: 128,
    totalRounds: 22,
    playerCount: 5,
    myBest: 73,
    recordScore: 70,
    recordHolder: 'Ian McGowan',
    gradient: ['#5A3D7A', '#8B6DAF'],
  },
  {
    id: 'c4',
    name: 'TPC Sawgrass',
    city: 'Ponte Vedra Beach',
    state: 'FL',
    par: 72,
    slope: 148,
    totalRounds: 12,
    playerCount: 4,
    myBest: 82,
    recordScore: 74,
    recordHolder: 'Tommy Fleetwood',
    gradient: ['#1A3A5C', '#2E6B8A'],
  },
  {
    id: 'c5',
    name: 'Pebble Beach Golf Links',
    city: 'Pebble Beach',
    state: 'CA',
    par: 72,
    slope: 145,
    totalRounds: 8,
    playerCount: 3,
    myBest: 84,
    recordScore: 76,
    recordHolder: 'Drew Patterson',
    gradient: ['#3A5A3A', '#6B8F6B'],
  },
  {
    id: 'c6',
    name: 'TPC Scottsdale',
    city: 'Scottsdale',
    state: 'AZ',
    par: 71,
    slope: 139,
    totalRounds: 6,
    playerCount: 3,
    myBest: null,
    recordScore: 72,
    recordHolder: 'Jake Sullivan',
    gradient: ['#8B6B3A', '#C4994A'],
  },
  {
    id: 'c7',
    name: 'Greystone Golf Club',
    city: 'Dickson',
    state: 'TN',
    par: 72,
    slope: 126,
    totalRounds: 18,
    playerCount: 5,
    myBest: 75,
    recordScore: null,
    recordHolder: null,
    gradient: ['#4A6B5A', '#7A9B8A'],
  },
  {
    id: 'c8',
    name: 'The Governors Club',
    city: 'Brentwood',
    state: 'TN',
    par: 72,
    slope: 140,
    totalRounds: 14,
    playerCount: 4,
    myBest: 78,
    recordScore: 69,
    recordHolder: 'Tommy Fleetwood',
    gradient: ['#2D3A2D', '#4A5C4A'],
  },
];

// Pre-sorted by most rounds
export const PLAYED_SORTED = [...MOCK_PLAYED_COURSES].sort(
  (a, b) => b.totalRounds - a.totalRounds,
);

// ─── Tier 2: Community courses (not played by group) ────────────────
export const MOCK_COMMUNITY_COURSES: CommunityCourse[] = [
  {
    id: 'cc1',
    name: 'Whistling Straits',
    city: 'Haven',
    state: 'WI',
    communityRounds: 42,
    communityAvg: 86.3,
  },
  {
    id: 'cc2',
    name: 'Bethpage Black',
    city: 'Farmingdale',
    state: 'NY',
    communityRounds: 38,
    communityAvg: 88.1,
  },
  {
    id: 'cc3',
    name: 'Pinehurst No. 2',
    city: 'Pinehurst',
    state: 'NC',
    communityRounds: 55,
    communityAvg: 84.7,
  },
  {
    id: 'cc4',
    name: 'Kiawah Island Ocean Course',
    city: 'Kiawah Island',
    state: 'SC',
    communityRounds: 29,
    communityAvg: 89.4,
  },
  {
    id: 'cc5',
    name: 'Torrey Pines South',
    city: 'La Jolla',
    state: 'CA',
    communityRounds: 18,
    communityAvg: 82.9,
  },
];
