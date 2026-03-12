// TODO: Player detail types (180 lines)

export type PlayerStats = {
  roundsPlayed: number;
  averageScore: number;
  handicapIndex: number;
  bestRound: number;
  fairwayHitPct: number;
  girPct: number;
  puttsPerRound: number;
  scramblePct: number;
};

export type PlayerRound = {
  id: string;
  courseName: string;
  score: number;
  date: string;
  format: string;
};
