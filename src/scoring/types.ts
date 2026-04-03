// ─── Scoring types ───────────────────────────────────────────────────
import type { MomentType } from '../components/DormieMoment';
import type { SideGameEvent } from '../components/SideGameToast';
import type { PlayerHoleResult } from '../components/HoleTransitionBanner';

export type LinkedSeason = {
  seasonId: string;
  seasonName: string;
  weekNumber: number;
  format: string;
  multiplier: number;
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

export type GameResult = {
  title: string;
  lines: { text: string; value?: string; highlight?: boolean }[];
};

export type { MomentType, SideGameEvent, PlayerHoleResult };
