// ─── Player Statistics Types & Mock Data ─────────────────────────────

// ─── Score Category Colors ───────────────────────────────────────────
export const STAT_COLORS = {
  eagle: '#D4AF37',
  birdie: '#1B5E20',
  par: '#9E9E9E',
  bogey: '#616161',
  double: '#424242',
  player: '#2E7D32',
  group: '#757575',
} as const;

// ─── Types ───────────────────────────────────────────────────────────
export type ScoringSummary = {
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubles: number;
  totalRounds: number;
};

export type PerRoundStat = {
  roundId: string;
  label: string;
  percentage: number;
};

export type GreenStats = {
  playerPct: number;
  groupAvgPct: number;
  perRound: PerRoundStat[];
  trendPct: number; // positive = improvement, negative = decline
  playerAvgPct: number;
};

export type FairwayStats = {
  playerPct: number;
  groupAvgPct: number;
  perRound: PerRoundStat[];
  trendPct: number;
  playerAvgPct: number;
};

export type PuttingStats = {
  avgPuttsPerRound: number;
  puttsPerGir: number;
  groupPuttsPerGir: number;
  threePuttAvoidancePct: number;
  onePuttConversionPct: number;
  perRound: PerRoundStat[];
  trendPutts: number; // negative = improvement (fewer putts)
};

export type PlayerStats = {
  scoring: ScoringSummary;
  greens: GreenStats;
  fairways: FairwayStats;
  putting: PuttingStats;
};

export type RoundStats = {
  scoring: ScoringSummary;
  girCount: number;
  girTotal: number;
  girPct: number;
  playerAvgGirPct: number;
  firCount: number;
  firTotal: number;
  firPct: number;
  playerAvgFirPct: number;
  totalPutts: number;
  puttsPerGir: number;
  threePutts: number;
};

// ─── Mock Data ───────────────────────────────────────────────────────
export const MOCK_PLAYER_STATS: PlayerStats = {
  scoring: {
    eagles: 2,
    birdies: 45,
    pars: 112,
    bogeys: 38,
    doubles: 8,
    totalRounds: 47,
  },
  greens: {
    playerPct: 72,
    groupAvgPct: 65,
    playerAvgPct: 68,
    trendPct: 4,
    perRound: [
      { roundId: 'r1', label: 'RD 1', percentage: 68 },
      { roundId: 'r2', label: 'RD 2', percentage: 75 },
      { roundId: 'r3', label: 'RD 3', percentage: 71 },
      { roundId: 'r4', label: 'RD 4', percentage: 64 },
      { roundId: 'r5', label: 'RD 5', percentage: 78 },
      { roundId: 'r6', label: 'RD 6', percentage: 72 },
    ],
  },
  fairways: {
    playerPct: 71,
    groupAvgPct: 62,
    playerAvgPct: 67,
    trendPct: 3,
    perRound: [
      { roundId: 'r1', label: 'RD 1', percentage: 65 },
      { roundId: 'r2', label: 'RD 2', percentage: 72 },
      { roundId: 'r3', label: 'RD 3', percentage: 68 },
      { roundId: 'r4', label: 'RD 4', percentage: 71 },
      { roundId: 'r5', label: 'RD 5', percentage: 75 },
      { roundId: 'r6', label: 'RD 6', percentage: 69 },
    ],
  },
  putting: {
    avgPuttsPerRound: 30.2,
    puttsPerGir: 1.82,
    groupPuttsPerGir: 1.95,
    threePuttAvoidancePct: 94,
    onePuttConversionPct: 38,
    trendPutts: -0.8,
    perRound: [
      { roundId: 'r1', label: 'RD 1', percentage: 72 },
      { roundId: 'r2', label: 'RD 2', percentage: 68 },
      { roundId: 'r3', label: 'RD 3', percentage: 75 },
      { roundId: 'r4', label: 'RD 4', percentage: 70 },
      { roundId: 'r5', label: 'RD 5', percentage: 80 },
      { roundId: 'r6', label: 'RD 6', percentage: 74 },
    ],
  },
};

// Averages for a single round (for PostRoundSummary comparison)
export const MOCK_PLAYER_AVERAGES = {
  birdiesPerRound: 2.1,
  parsPerRound: 8.5,
  bogeysPerRound: 4.2,
  girPct: 61,
  firPct: 68,
  puttsPerRound: 31.4,
};
