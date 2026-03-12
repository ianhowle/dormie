// TODO: H2H types (115 lines)

export type H2HRecord = {
  player1Id: string;
  player2Id: string;
  player1Wins: number;
  player2Wins: number;
  ties: number;
  totalRounds: number;
};

export type H2HRound = {
  roundId: string;
  date: string;
  courseName: string;
  player1Score: number;
  player2Score: number;
  winner: string | null;
};
