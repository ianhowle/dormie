export type H2HMatchup = {
  opponentId: string;
  opponentName: string;
  opponentHandicap: number;
  myWins: number;
  theirWins: number;
  ties: number;
  totalMatches: number;
  courseBreakdown: CourseH2H[];
};

export type CourseH2H = {
  courseId: string;
  courseName: string;
  myBest: number;
  theirBest: number;
};

export const MOCK_H2H: H2HMatchup[] = [
  {
    opponentId: '2',
    opponentName: 'Tommy Fleetwood',
    opponentHandicap: 5,
    myWins: 4,
    theirWins: 9,
    ties: 2,
    totalMatches: 15,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 68 },
      { courseId: 'c2', courseName: 'Gaylord Springs', myBest: 76, theirBest: 73 },
      { courseId: 'c3', courseName: 'Nashville Golf & Athletic', myBest: 73, theirBest: 74 },
      { courseId: 'c4', courseName: 'TPC Sawgrass', myBest: 82, theirBest: 77 },
      { courseId: 'c8', courseName: 'The Governors Club', myBest: 78, theirBest: 72 },
    ],
  },
  {
    opponentId: '3',
    opponentName: 'Jake Sullivan',
    opponentHandicap: 12,
    myWins: 8,
    theirWins: 3,
    ties: 1,
    totalMatches: 12,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 79 },
      { courseId: 'c2', courseName: 'Gaylord Springs', myBest: 76, theirBest: 82 },
      { courseId: 'c3', courseName: 'Nashville Golf & Athletic', myBest: 73, theirBest: 75 },
      { courseId: 'c7', courseName: 'Greystone Golf Club', myBest: 75, theirBest: 80 },
    ],
  },
  {
    opponentId: '4',
    opponentName: 'Drew Patterson',
    opponentHandicap: 6,
    myWins: 6,
    theirWins: 7,
    ties: 0,
    totalMatches: 13,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 72 },
      { courseId: 'c2', courseName: 'Gaylord Springs', myBest: 76, theirBest: 71 },
      { courseId: 'c5', courseName: 'Pebble Beach Golf Links', myBest: 84, theirBest: 79 },
      { courseId: 'c8', courseName: 'The Governors Club', myBest: 78, theirBest: 76 },
    ],
  },
  {
    opponentId: '5',
    opponentName: 'Cole Bridges',
    opponentHandicap: 14,
    myWins: 7,
    theirWins: 1,
    ties: 0,
    totalMatches: 8,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 82 },
      { courseId: 'c3', courseName: 'Nashville Golf & Athletic', myBest: 73, theirBest: 84 },
    ],
  },
  {
    opponentId: '6',
    opponentName: 'Nate Harmon',
    opponentHandicap: 10,
    myWins: 5,
    theirWins: 5,
    ties: 2,
    totalMatches: 12,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 74 },
      { courseId: 'c2', courseName: 'Gaylord Springs', myBest: 76, theirBest: 77 },
      { courseId: 'c7', courseName: 'Greystone Golf Club', myBest: 75, theirBest: 76 },
    ],
  },
  {
    opponentId: '7',
    opponentName: 'Will Chambers',
    opponentHandicap: 18,
    myWins: 6,
    theirWins: 0,
    ties: 0,
    totalMatches: 6,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 88 },
      { courseId: 'c3', courseName: 'Nashville Golf & Athletic', myBest: 73, theirBest: 85 },
    ],
  },
  {
    opponentId: '8',
    opponentName: 'Ryan Kessler',
    opponentHandicap: 9,
    myWins: 5,
    theirWins: 4,
    ties: 1,
    totalMatches: 10,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 75 },
      { courseId: 'c2', courseName: 'Gaylord Springs', myBest: 76, theirBest: 73 },
      { courseId: 'c3', courseName: 'Nashville Golf & Athletic', myBest: 73, theirBest: 76 },
    ],
  },
];
