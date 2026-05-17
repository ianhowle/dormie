// =============================================================
// Per-game stake config types
// =============================================================
// Pure types module (no React Native imports) so the wizard
// reducer, helpers, and tests can reference PerGameStakeConfig
// without pulling the PerGameStakeInput component's RN deps.
// PerGameStakeInput.tsx re-exports these for existing call sites.
// =============================================================

import type { ScoringFormat, SideGame } from '../../data/scoring';

export type PerGameStakeKey = ScoringFormat | SideGame;

export type StrokePlayPayoutKind = 'winner_takes_all' | 'split_top_3';
export interface StrokePlayConfig { payout: StrokePlayPayoutKind }

export interface SkinsConfig { carryOver: boolean }

export interface NassauTripleConfig {
  /** Stake on the front 9 match. */
  front9: number;
  /** Stake on the back 9 match. */
  back9: number;
  /** Stake on the overall 18-hole match. */
  total: number;
}

export type StablefordPayoutKind = 'per_point' | 'per_place';
export interface StablefordConfig { payout: StablefordPayoutKind }

export type PerGameStakeConfig =
  | { kind: 'none' }
  | { kind: 'strokePlayPayout';      strokePlay: StrokePlayConfig }
  | { kind: 'skinsCarryOver';        skins: SkinsConfig }
  | { kind: 'nassauTriple';          nassau: NassauTripleConfig }
  | { kind: 'stablefordPayoutKind';  stableford: StablefordConfig };
