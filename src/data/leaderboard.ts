export type LeaderboardPlayer = {
  id: string;
  name: string;
  handicap: number;
  courses: number;
  rounds: number;
  avgScore: number;
  bestRound: number;
  toPar: number; // average to-par (negative = under)
};

export type Season = {
  id: string;
  name: string;
  totalWeeks: number;
  currentWeek: number;
  yourPosition: number;
  totalPlayers: number;
};

export type LeaderboardScope = 'group' | 'field';

const ME: LeaderboardPlayer = {
  id: '1',
  name: 'Ian McGowan',
  handicap: 8,
  courses: 12,
  rounds: 47,
  avgScore: 79.2,
  bestRound: 72,
  toPar: -2.8,
};

export const MOCK_GROUP_PLAYERS: LeaderboardPlayer[] = [
  {
    id: '2',
    name: 'Tommy Fleetwood',
    handicap: 5,
    courses: 15,
    rounds: 62,
    avgScore: 76.4,
    bestRound: 68,
    toPar: -5.6,
  },
  ME,
  {
    id: '3',
    name: 'Jake Sullivan',
    handicap: 12,
    courses: 9,
    rounds: 34,
    avgScore: 82.1,
    bestRound: 75,
    toPar: -0.9,
  },
  {
    id: '4',
    name: 'Drew Patterson',
    handicap: 6,
    courses: 11,
    rounds: 41,
    avgScore: 78.5,
    bestRound: 71,
    toPar: -3.5,
  },
  {
    id: '5',
    name: 'Cole Bridges',
    handicap: 14,
    courses: 7,
    rounds: 28,
    avgScore: 84.3,
    bestRound: 78,
    toPar: 2.3,
  },
  {
    id: '6',
    name: 'Nate Harmon',
    handicap: 10,
    courses: 10,
    rounds: 39,
    avgScore: 81.0,
    bestRound: 74,
    toPar: -1.0,
  },
  {
    id: '7',
    name: 'Will Chambers',
    handicap: 18,
    courses: 5,
    rounds: 19,
    avgScore: 88.7,
    bestRound: 82,
    toPar: 6.7,
  },
  {
    id: '8',
    name: 'Ryan Kessler',
    handicap: 9,
    courses: 8,
    rounds: 31,
    avgScore: 80.4,
    bestRound: 73,
    toPar: -1.6,
  },
];

// Sorted by toPar ascending (best first)
export const MOCK_GROUP_RANKED = [...MOCK_GROUP_PLAYERS].sort(
  (a, b) => a.toPar - b.toPar,
);

export const MOCK_SEASONS: Season[] = [
  {
    id: 's1',
    name: '2026 Spring Championship',
    totalWeeks: 16,
    currentWeek: 9,
    yourPosition: 2,
    totalPlayers: 8,
  },
  {
    id: 's2',
    name: 'Winter Invitational',
    totalWeeks: 12,
    currentWeek: 12,
    yourPosition: 1,
    totalPlayers: 6,
  },
];

export const MY_ID = '1';
