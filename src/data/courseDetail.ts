// TODO: Course detail types (134 lines)

export type CourseStats = {
  roundsPlayed: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  averagePutts: number;
  hardestHole: number;
  easiestHole: number;
};

export type CourseLeaderboardEntry = {
  playerId: string;
  playerName: string;
  bestScore: number;
  roundsPlayed: number;
  averageScore: number;
};
