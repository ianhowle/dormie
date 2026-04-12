// ─── Scoring types ───────────────────────────────────────────────────
import type { MomentType } from '../components/DormieMoment';
import type { SideGameEvent } from '../components/SideGameToast';
import type { PlayerHoleResult } from '../components/HoleTransitionBanner';

export type SideGameWin = {
  label: string;
  points: number;
  holeNumber?: number | null;
};

export type LinkedSeason = {
  seasonId: string;
  seasonName: string;
  weekNumber: number;
  format: string;
  multiplier: number;
  sideGameWins?: SideGameWin[];
};

export type CompetitionTab = {
  key: string;
  label: string;
  type: 'round' | 'season' | 'trip' | 'matchup';
  data?: LinkedSeason;
};

export type PlayerConfig = {
  id: string;
  name: string;
  handicap: number;
};

export type HoleScore = {
  gross: number;
  putts: number;
  fir: boolean | null; // null for par 3s
  penalties?: { water: number; ob: number; lost: number };
  tags?: string[]; // Item 9: hole tags (Sand, Trees, Water, Penalty, Up & Down)
};

export type HammerState = {
  active: boolean;
  thrower: string;
  target: string;
  multiplier: number; // 2, 4, 8
  pending: boolean;
};

export type HammerResult = {
  thrower: string;
  target: string;
  multiplier: number;
  accepted: boolean;
};

export type WolfDecision = 'partner' | 'lone' | 'blind' | null;

export type WolfHoleState = {
  wolfPlayerId: string;
  decision: WolfDecision;
  partnerId: string | null;
};

export type LowHighTieHandling = 'halve' | 'carryover' | 'no_point';

export type LowHighHoleResult = {
  lowBallWinner: 'team1' | 'team2' | 'halved';
  highBallWinner: 'team1' | 'team2' | 'halved';
  totalWinner?: 'team1' | 'team2' | 'halved';
  birdieBonus?: boolean;
};

export type LowHighOptions = {
  tieHandling: LowHighTieHandling;
  birdieBonus: boolean;
  includeTotal: boolean;
};

export type LowHighPoints = {
  team1: number;
  team2: number;
  lowT1: number;
  lowT2: number;
  highT1: number;
  highT2: number;
  totalT1: number;
  totalT2: number;
  carryover: number;
};

export type SixSixSixScoringMethod = 'low_ball' | 'combined' | 'match_play';

export type SixSixSixSegment = {
  team1: [string, string];
  team2: [string, string];
  holeResults: Record<number, 'team1' | 'team2' | 'halved'>;
  team1Wins: number;
  team2Wins: number;
  winner: 'team1' | 'team2' | 'halved' | null;
};

export type SixSixSixResult = {
  segments: SixSixSixSegment[];
  dots: Record<string, number>;
};

export type BBBHolePoints = {
  bingo: string | null; // playerId
  bango: string | null; // playerId
  bongo: string | null; // playerId
};

export type ScoringEvent = {
  text: string;
  time: Date;
};

export type HoleData = {
  number: number;
  par: number;
  strokeIndex: number; // difficulty rank 1-18 for handicap allocation
  yards?: number; // yardage for selected tee
};

export type PlayerTotals = {
  player: PlayerConfig;
  gross: number;
  net: number;
  putts: number;
  firHit: number;
  firTotal: number;
  girCount: number;
  holesPlayed: number;
  scores: { hole: HoleData; score: HoleScore }[];
  par3Avg: number;
  par4Avg: number;
  par5Avg: number;
  upDownAttempts: number;
  upDownMade: number;
};

export type SummaryTab = 'scorecard' | 'stats' | 'games';

// ─── Competition Impact types ───────────────────────────────────────
export type SeasonImpact = {
  seasonName: string;
  pointsEarned: number;
  weekPosition: number;
  weekLabel: string; // "3rd place this week"
  previousRank: number;
  currentRank: number;
  rankChange: number; // positive = improved
  pointsBehindLeader: number;
  leaderName: string;
  isPlayoffWeek: boolean;
  isChampionshipWeek: boolean;
  multiplier: number;
  isSeasonHigh: boolean;
};

export type RyderCupImpact = {
  opponentName: string;
  userScore: number;
  opponentScore: number;
  matchResult: 'win' | 'loss' | 'halved';
  pointsForTeam: number; // 1, 0.5, or 0
  teamName: string;
  teamColor: 'red' | 'blue';
  teamScore: number;
  opponentTeamScore: number;
};

export type HandicapImpact = {
  previousIndex: number;
  newIndex: number;
  change: number; // negative = improved
  isCountingRound: boolean;
  droppedRoundScore: number | null; // score that fell off the 20-round window
};

export type GameResult = {
  title: string;
  lines: { text: string; value?: string; highlight?: boolean }[];
};

export type { MomentType, SideGameEvent, PlayerHoleResult };
