// ─── Types ───────────────────────────────────────────────────────────
export type PlayerDetailData = {
  id: string;
  name: string;
  handicap: number;
  city: string;
  state: string;
  isInGroup: boolean;
  stats: {
    best: number;
    avg: number;
    courses: number;
    rounds: number;
  };
  sourceCounts: {
    trips: number;
    seasons: number;
  };
  bestRounds: BestRound[];
};

export type BestRound = {
  id: string;
  courseName: string;
  coursePar: number;
  score: number;
  toPar: number;
  date: string;
  source: 'trip' | 'season' | 'casual';
};

// ─── Mock data keyed by player id ────────────────────────────────────
export const MOCK_PLAYER_DETAILS: Record<string, PlayerDetailData> = {
  '1': {
    id: '1',
    name: 'Ian McGowan',
    handicap: 8,
    city: 'Nashville',
    state: 'TN',
    isInGroup: true,
    stats: { best: 72, avg: 79.2, courses: 12, rounds: 47 },
    sourceCounts: { trips: 14, seasons: 18 },
    bestRounds: [
      { id: 'r1', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 72, toPar: 0, date: '2026-02-22', source: 'season' },
      { id: 'r2', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 73, toPar: 1, date: '2026-01-18', source: 'casual' },
      { id: 'r3', courseName: 'Hermitage Golf Course', coursePar: 72, score: 74, toPar: 2, date: '2026-02-15', source: 'season' },
      { id: 'r4', courseName: 'Greystone Golf Club', coursePar: 72, score: 75, toPar: 3, date: '2026-01-05', source: 'casual' },
      { id: 'r5', courseName: 'Gaylord Springs', coursePar: 72, score: 76, toPar: 4, date: '2026-03-01', source: 'trip' },
      { id: 'r6', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 77, toPar: 5, date: '2025-12-20', source: 'season' },
      { id: 'r7', courseName: 'The Governors Club', coursePar: 72, score: 78, toPar: 6, date: '2025-11-15', source: 'casual' },
      { id: 'r8', courseName: 'Hermitage Golf Course', coursePar: 72, score: 79, toPar: 7, date: '2025-10-14', source: 'casual' },
      { id: 'r9', courseName: 'Gaylord Springs', coursePar: 72, score: 80, toPar: 8, date: '2025-09-28', source: 'trip' },
      { id: 'r10', courseName: 'TPC Sawgrass', coursePar: 72, score: 82, toPar: 10, date: '2025-08-12', source: 'trip' },
    ],
  },
  '2': {
    id: '2',
    name: 'Tommy Fleetwood',
    handicap: 5,
    city: 'Nashville',
    state: 'TN',
    isInGroup: true,
    stats: { best: 68, avg: 76.4, courses: 15, rounds: 62 },
    sourceCounts: { trips: 20, seasons: 24 },
    bestRounds: [
      { id: 'r11', courseName: 'Hermitage Golf Course', coursePar: 72, score: 68, toPar: -4, date: '2026-02-20', source: 'season' },
      { id: 'r12', courseName: 'The Governors Club', coursePar: 72, score: 69, toPar: -3, date: '2026-01-30', source: 'season' },
      { id: 'r13', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 70, toPar: -2, date: '2026-01-08', source: 'casual' },
      { id: 'r14', courseName: 'Gaylord Springs', coursePar: 72, score: 71, toPar: -1, date: '2025-12-15', source: 'trip' },
      { id: 'r15', courseName: 'TPC Sawgrass', coursePar: 72, score: 72, toPar: 0, date: '2025-11-20', source: 'trip' },
      { id: 'r16', courseName: 'Pebble Beach Golf Links', coursePar: 72, score: 73, toPar: 1, date: '2025-10-05', source: 'trip' },
      { id: 'r17', courseName: 'Hermitage Golf Course', coursePar: 72, score: 74, toPar: 2, date: '2025-09-18', source: 'season' },
      { id: 'r18', courseName: 'TPC Sawgrass', coursePar: 72, score: 74, toPar: 2, date: '2025-08-22', source: 'trip' },
      { id: 'r19', courseName: 'Greystone Golf Club', coursePar: 72, score: 75, toPar: 3, date: '2025-07-14', source: 'casual' },
      { id: 'r20', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 76, toPar: 4, date: '2025-06-30', source: 'season' },
    ],
  },
  '3': {
    id: '3',
    name: 'Jake Sullivan',
    handicap: 12,
    city: 'Franklin',
    state: 'TN',
    isInGroup: true,
    stats: { best: 75, avg: 82.1, courses: 9, rounds: 34 },
    sourceCounts: { trips: 8, seasons: 12 },
    bestRounds: [
      { id: 'r21', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 75, toPar: 3, date: '2026-01-20', source: 'season' },
      { id: 'r22', courseName: 'Greystone Golf Club', coursePar: 72, score: 77, toPar: 5, date: '2026-01-05', source: 'casual' },
      { id: 'r23', courseName: 'Hermitage Golf Course', coursePar: 72, score: 79, toPar: 7, date: '2025-12-30', source: 'season' },
      { id: 'r24', courseName: 'Gaylord Springs', coursePar: 72, score: 80, toPar: 8, date: '2025-11-18', source: 'trip' },
      { id: 'r25', courseName: 'The Governors Club', coursePar: 72, score: 81, toPar: 9, date: '2025-10-22', source: 'casual' },
      { id: 'r26', courseName: 'TPC Scottsdale', coursePar: 71, score: 82, toPar: 11, date: '2025-09-15', source: 'trip' },
      { id: 'r27', courseName: 'Hermitage Golf Course', coursePar: 72, score: 83, toPar: 11, date: '2025-08-20', source: 'casual' },
      { id: 'r28', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 84, toPar: 12, date: '2025-07-10', source: 'season' },
    ],
  },
  '4': {
    id: '4',
    name: 'Drew Patterson',
    handicap: 6,
    city: 'Brentwood',
    state: 'TN',
    isInGroup: true,
    stats: { best: 71, avg: 78.5, courses: 11, rounds: 41 },
    sourceCounts: { trips: 12, seasons: 16 },
    bestRounds: [
      { id: 'r31', courseName: 'Gaylord Springs', coursePar: 72, score: 71, toPar: -1, date: '2026-02-18', source: 'season' },
      { id: 'r32', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 72, toPar: 0, date: '2026-01-22', source: 'casual' },
      { id: 'r33', courseName: 'Hermitage Golf Course', coursePar: 72, score: 72, toPar: 0, date: '2026-02-10', source: 'season' },
      { id: 'r34', courseName: 'Pebble Beach Golf Links', coursePar: 72, score: 74, toPar: 2, date: '2025-12-08', source: 'trip' },
      { id: 'r35', courseName: 'The Governors Club', coursePar: 72, score: 75, toPar: 3, date: '2025-11-14', source: 'casual' },
      { id: 'r36', courseName: 'Greystone Golf Club', coursePar: 72, score: 76, toPar: 4, date: '2025-10-20', source: 'season' },
      { id: 'r37', courseName: 'TPC Sawgrass', coursePar: 72, score: 77, toPar: 5, date: '2025-09-05', source: 'trip' },
      { id: 'r38', courseName: 'TPC Scottsdale', coursePar: 71, score: 78, toPar: 7, date: '2025-08-18', source: 'trip' },
      { id: 'r39', courseName: 'Hermitage Golf Course', coursePar: 72, score: 79, toPar: 7, date: '2025-07-25', source: 'casual' },
      { id: 'r40', courseName: 'Gaylord Springs', coursePar: 72, score: 80, toPar: 8, date: '2025-06-15', source: 'season' },
    ],
  },
  '5': {
    id: '5',
    name: 'Cole Bridges',
    handicap: 14,
    city: 'Murfreesboro',
    state: 'TN',
    isInGroup: true,
    stats: { best: 78, avg: 84.3, courses: 7, rounds: 28 },
    sourceCounts: { trips: 6, seasons: 10 },
    bestRounds: [
      { id: 'r41', courseName: 'Greystone Golf Club', coursePar: 72, score: 78, toPar: 6, date: '2026-02-05', source: 'casual' },
      { id: 'r42', courseName: 'Hermitage Golf Course', coursePar: 72, score: 80, toPar: 8, date: '2026-01-12', source: 'season' },
      { id: 'r43', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 81, toPar: 9, date: '2025-12-18', source: 'season' },
      { id: 'r44', courseName: 'Hermitage Golf Course', coursePar: 72, score: 82, toPar: 10, date: '2025-11-08', source: 'trip' },
      { id: 'r45', courseName: 'Gaylord Springs', coursePar: 72, score: 83, toPar: 11, date: '2025-10-22', source: 'casual' },
      { id: 'r46', courseName: 'The Governors Club', coursePar: 72, score: 85, toPar: 13, date: '2025-09-14', source: 'casual' },
      { id: 'r47', courseName: 'Greystone Golf Club', coursePar: 72, score: 86, toPar: 14, date: '2025-08-30', source: 'season' },
    ],
  },
  '6': {
    id: '6',
    name: 'Nate Harmon',
    handicap: 10,
    city: 'Nashville',
    state: 'TN',
    isInGroup: true,
    stats: { best: 74, avg: 81.0, courses: 10, rounds: 39 },
    sourceCounts: { trips: 10, seasons: 14 },
    bestRounds: [
      { id: 'r51', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 74, toPar: 2, date: '2026-02-08', source: 'season' },
      { id: 'r52', courseName: 'Hermitage Golf Course', coursePar: 72, score: 75, toPar: 3, date: '2026-01-15', source: 'season' },
      { id: 'r53', courseName: 'Greystone Golf Club', coursePar: 72, score: 77, toPar: 5, date: '2025-12-28', source: 'casual' },
      { id: 'r54', courseName: 'Gaylord Springs', coursePar: 72, score: 78, toPar: 6, date: '2025-11-20', source: 'trip' },
      { id: 'r55', courseName: 'The Governors Club', coursePar: 72, score: 79, toPar: 7, date: '2025-10-18', source: 'casual' },
      { id: 'r56', courseName: 'Hermitage Golf Course', coursePar: 72, score: 80, toPar: 8, date: '2025-09-25', source: 'season' },
      { id: 'r57', courseName: 'TPC Sawgrass', coursePar: 72, score: 82, toPar: 10, date: '2025-08-10', source: 'trip' },
      { id: 'r58', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 83, toPar: 11, date: '2025-07-05', source: 'casual' },
      { id: 'r59', courseName: 'TPC Scottsdale', coursePar: 71, score: 84, toPar: 13, date: '2025-06-20', source: 'trip' },
    ],
  },
  '7': {
    id: '7',
    name: 'Will Chambers',
    handicap: 18,
    city: 'Hendersonville',
    state: 'TN',
    isInGroup: true,
    stats: { best: 82, avg: 88.7, courses: 5, rounds: 19 },
    sourceCounts: { trips: 4, seasons: 6 },
    bestRounds: [
      { id: 'r61', courseName: 'Greystone Golf Club', coursePar: 72, score: 82, toPar: 10, date: '2026-01-25', source: 'casual' },
      { id: 'r62', courseName: 'Hermitage Golf Course', coursePar: 72, score: 84, toPar: 12, date: '2025-12-10', source: 'season' },
      { id: 'r63', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 86, toPar: 14, date: '2025-11-02', source: 'season' },
      { id: 'r64', courseName: 'Hermitage Golf Course', coursePar: 72, score: 88, toPar: 16, date: '2025-10-05', source: 'casual' },
      { id: 'r65', courseName: 'Gaylord Springs', coursePar: 72, score: 90, toPar: 18, date: '2025-09-15', source: 'trip' },
      { id: 'r66', courseName: 'Greystone Golf Club', coursePar: 72, score: 92, toPar: 20, date: '2025-08-08', source: 'casual' },
    ],
  },
  '8': {
    id: '8',
    name: 'Ryan Kessler',
    handicap: 9,
    city: 'Mount Juliet',
    state: 'TN',
    isInGroup: true,
    stats: { best: 73, avg: 80.4, courses: 8, rounds: 31 },
    sourceCounts: { trips: 8, seasons: 12 },
    bestRounds: [
      { id: 'r71', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 73, toPar: 1, date: '2026-02-12', source: 'season' },
      { id: 'r72', courseName: 'Hermitage Golf Course', coursePar: 72, score: 75, toPar: 3, date: '2026-01-22', source: 'season' },
      { id: 'r73', courseName: 'Greystone Golf Club', coursePar: 72, score: 76, toPar: 4, date: '2025-12-15', source: 'casual' },
      { id: 'r74', courseName: 'Gaylord Springs', coursePar: 72, score: 78, toPar: 6, date: '2026-01-10', source: 'trip' },
      { id: 'r75', courseName: 'The Governors Club', coursePar: 72, score: 79, toPar: 7, date: '2025-11-28', source: 'casual' },
      { id: 'r76', courseName: 'Hermitage Golf Course', coursePar: 72, score: 80, toPar: 8, date: '2025-10-18', source: 'season' },
      { id: 'r77', courseName: 'TPC Sawgrass', coursePar: 72, score: 82, toPar: 10, date: '2025-09-05', source: 'trip' },
      { id: 'r78', courseName: 'Nashville Golf & Athletic', coursePar: 72, score: 83, toPar: 11, date: '2025-08-20', source: 'casual' },
      { id: 'r79', courseName: 'Gaylord Springs', coursePar: 72, score: 84, toPar: 12, date: '2025-07-12', source: 'trip' },
    ],
  },
};

// Lookup helper
export function getPlayerDetail(playerId: string): PlayerDetailData | null {
  return MOCK_PLAYER_DETAILS[playerId] ?? null;
}
