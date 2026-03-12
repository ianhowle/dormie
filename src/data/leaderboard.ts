// TODO: Leaderboard types (29 lines)

export type LeaderboardEntry = {
  playerId: string;
  playerName: string;
  handicapIndex: number;
  roundsPlayed: number;
  averageScore: number;
  rank: number;
};

export type LeaderboardScope = 'group' | 'field';
