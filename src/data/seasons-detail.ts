// TODO: FedEx Cup computation (526 lines)

export type SeasonStanding = {
  playerId: string;
  playerName: string;
  points: number;
  rank: number;
  eventsPlayed: number;
  wins: number;
  topFives: number;
  topTens: number;
};

export type PlayoffStatus = 'regular' | 'playoffs' | 'finals' | 'completed';

export function calculateFedExPoints(
  _finishPosition: number,
  _fieldSize: number,
  _isMajor: boolean,
): number {
  // TODO: Full FedEx Cup points calculation
  return 0;
}

export function getPlayoffCutLine(_standings: SeasonStanding[]): number {
  // TODO: Calculate playoff cut line
  return 30;
}
