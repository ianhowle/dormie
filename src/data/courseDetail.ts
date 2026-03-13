// ─── Types ───────────────────────────────────────────────────────────
export type CourseDetailData = {
  id: string;
  name: string;
  city: string;
  state: string;
  par: number;
  slope: number;
  rating: number;
  totalRounds: number;
  gradient: [string, string];
  myHistory: MyHistory | null; // null if user hasn't played
  leaderboard: LeaderboardRow[];
  communityRounds: number | null;
  communityAvg: number | null;
};

export type MyHistory = {
  best: number;
  avg: number;
  worst: number;
  rounds: number;
  scores: ScoreEntry[];
};

export type ScoreEntry = {
  id: string;
  score: number;
  date: string;
  source: 'trip' | 'season' | 'casual';
  label: string; // e.g. "Scottsdale Trip" or "Spring Championship"
};

export type LeaderboardRow = {
  playerId: string;
  playerName: string;
  handicap: number;
  bestScore: number;
  toPar: number;
  datePlayed: string;
  isMe: boolean;
};

// ─── Mock data keyed by course id ────────────────────────────────────
export const MOCK_COURSE_DETAILS: Record<string, CourseDetailData> = {
  c1: {
    id: 'c1',
    name: 'Hermitage Golf Course',
    city: 'Old Hickory',
    state: 'TN',
    par: 72,
    slope: 131,
    rating: 72.4,
    totalRounds: 34,
    gradient: ['#1E4D2B', '#2D6A3F'],
    communityRounds: null,
    communityAvg: null,
    myHistory: {
      best: 74,
      avg: 78.3,
      worst: 85,
      rounds: 11,
      scores: [
        { id: 's1', score: 74, date: '2026-02-15', source: 'season', label: 'Spring Championship' },
        { id: 's2', score: 76, date: '2026-01-28', source: 'casual', label: 'Weekend Round' },
        { id: 's3', score: 79, date: '2026-01-10', source: 'trip', label: 'Nashville Trip' },
        { id: 's4', score: 77, date: '2025-12-20', source: 'season', label: 'Winter Invitational' },
        { id: 's5', score: 85, date: '2025-11-08', source: 'casual', label: 'Saturday Round' },
        { id: 's6', score: 80, date: '2025-10-14', source: 'casual', label: 'Afternoon 18' },
      ],
    },
    leaderboard: [
      { playerId: '2', playerName: 'Tommy Fleetwood', handicap: 5, bestScore: 68, toPar: -4, datePlayed: '2026-02-20', isMe: false },
      { playerId: '4', playerName: 'Drew Patterson', handicap: 6, bestScore: 72, toPar: 0, datePlayed: '2026-02-10', isMe: false },
      { playerId: '1', playerName: 'Ian McGowan', handicap: 8, bestScore: 74, toPar: 2, datePlayed: '2026-02-15', isMe: true },
      { playerId: '8', playerName: 'Ryan Kessler', handicap: 9, bestScore: 75, toPar: 3, datePlayed: '2026-01-22', isMe: false },
      { playerId: '6', playerName: 'Nate Harmon', handicap: 10, bestScore: 77, toPar: 5, datePlayed: '2026-01-15', isMe: false },
      { playerId: '3', playerName: 'Jake Sullivan', handicap: 12, bestScore: 79, toPar: 7, datePlayed: '2025-12-30', isMe: false },
      { playerId: '5', playerName: 'Cole Bridges', handicap: 14, bestScore: 82, toPar: 10, datePlayed: '2025-12-18', isMe: false },
    ],
  },
  c2: {
    id: 'c2',
    name: 'Gaylord Springs',
    city: 'Nashville',
    state: 'TN',
    par: 72,
    slope: 135,
    rating: 73.8,
    totalRounds: 28,
    gradient: ['#2A4A6B', '#5B7FA5'],
    communityRounds: null,
    communityAvg: null,
    myHistory: {
      best: 76,
      avg: 80.5,
      worst: 87,
      rounds: 8,
      scores: [
        { id: 's7', score: 76, date: '2026-03-01', source: 'trip', label: 'Nashville Trip' },
        { id: 's8', score: 78, date: '2026-02-05', source: 'season', label: 'Spring Championship' },
        { id: 's9', score: 83, date: '2025-12-12', source: 'casual', label: 'Sunday Round' },
        { id: 's10', score: 87, date: '2025-11-20', source: 'casual', label: 'Practice Round' },
      ],
    },
    leaderboard: [
      { playerId: '4', playerName: 'Drew Patterson', handicap: 6, bestScore: 71, toPar: -1, datePlayed: '2026-02-18', isMe: false },
      { playerId: '2', playerName: 'Tommy Fleetwood', handicap: 5, bestScore: 73, toPar: 1, datePlayed: '2026-01-25', isMe: false },
      { playerId: '1', playerName: 'Ian McGowan', handicap: 8, bestScore: 76, toPar: 4, datePlayed: '2026-03-01', isMe: true },
      { playerId: '8', playerName: 'Ryan Kessler', handicap: 9, bestScore: 78, toPar: 6, datePlayed: '2026-01-10', isMe: false },
      { playerId: '6', playerName: 'Nate Harmon', handicap: 10, bestScore: 80, toPar: 8, datePlayed: '2025-12-28', isMe: false },
    ],
  },
  c3: {
    id: 'c3',
    name: 'Nashville Golf & Athletic',
    city: 'Nashville',
    state: 'TN',
    par: 72,
    slope: 128,
    rating: 71.2,
    totalRounds: 22,
    gradient: ['#5A3D7A', '#8B6DAF'],
    communityRounds: null,
    communityAvg: null,
    myHistory: {
      best: 73,
      avg: 77.8,
      worst: 82,
      rounds: 7,
      scores: [
        { id: 's11', score: 73, date: '2026-02-22', source: 'season', label: 'Spring Championship' },
        { id: 's12', score: 75, date: '2026-01-18', source: 'casual', label: 'Twilight Round' },
        { id: 's13', score: 82, date: '2025-11-30', source: 'casual', label: 'Weekend Round' },
      ],
    },
    leaderboard: [
      { playerId: '1', playerName: 'Ian McGowan', handicap: 8, bestScore: 73, toPar: 1, datePlayed: '2026-02-22', isMe: true },
      { playerId: '2', playerName: 'Tommy Fleetwood', handicap: 5, bestScore: 74, toPar: 2, datePlayed: '2026-02-08', isMe: false },
      { playerId: '3', playerName: 'Jake Sullivan', handicap: 12, bestScore: 75, toPar: 3, datePlayed: '2026-01-20', isMe: false },
      { playerId: '4', playerName: 'Drew Patterson', handicap: 6, bestScore: 76, toPar: 4, datePlayed: '2025-12-15', isMe: false },
    ],
  },
};

// Community-only course detail (for courses the group hasn't played)
export const MOCK_COMMUNITY_DETAILS: Record<string, CourseDetailData> = {
  cc1: {
    id: 'cc1',
    name: 'Whistling Straits',
    city: 'Haven',
    state: 'WI',
    par: 72,
    slope: 151,
    rating: 76.1,
    totalRounds: 42,
    gradient: ['#3A5A3A', '#6B8F6B'],
    communityRounds: 42,
    communityAvg: 86.3,
    myHistory: null,
    leaderboard: [],
  },
  cc2: {
    id: 'cc2',
    name: 'Bethpage Black',
    city: 'Farmingdale',
    state: 'NY',
    par: 71,
    slope: 155,
    rating: 77.5,
    totalRounds: 38,
    gradient: ['#2D3A2D', '#4A5C4A'],
    communityRounds: 38,
    communityAvg: 88.1,
    myHistory: null,
    leaderboard: [],
  },
};

// Lookup helper — searches played then community
export function getCourseDetail(courseId: string): CourseDetailData | null {
  return MOCK_COURSE_DETAILS[courseId] ?? MOCK_COMMUNITY_DETAILS[courseId] ?? null;
}
