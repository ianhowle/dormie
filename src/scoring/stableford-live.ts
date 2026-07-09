// ─── Stableford — live (in-round) points ────────────────────────────
// JSX-free + supabase-free so it imports cleanly under ts-node (same
// pattern as src/scoring/gir.ts and src/scoring/matchplay-result.ts).
// Built on the canonical leaf `calculateStablefordPoints`. Stage 1 of
// the Stableford live-scoring work: pure derivation, no UI, no state.
//
// scoreMode follows matchPlayState's gross/net convention:
//   'gross' → every hole scored against par with 0 handicap strokes.
//   'net'   → per-hole handicap strokes subtracted before the points scale.

import type { HoleData, HoleScore } from './types';
import { calculateStablefordPoints } from '../data/scoring';

export type StablefordLiveEntry = {
  /** Running Stableford points across holes scored so far. */
  points: number;
  /** Number of holes this player has entered a score for. */
  thru: number;
};

/**
 * Compute live Stableford points + holes-played for every player who has
 * entered at least one score.
 *
 * Walks `holes` in play order; for each hole, every player with a score on it
 * accrues that hole's points (net per `scoreMode`) and advances their `thru`.
 * Holes with no score for a player contribute nothing and do not count toward
 * that player's `thru` — so a mid-round board yields partial totals correctly.
 *
 * Player set is derived from the scores themselves (no player-count or roster
 * assumption — Stableford is an individual format played by any number). A
 * player who has entered nothing simply does not appear; an empty board yields
 * an empty map.
 *
 * @param holes           Holes in play order.
 * @param allScores       Live scores: Map<holeNumber, Map<playerId, HoleScore>>.
 * @param handicapStrokes Map<playerId, Map<holeNumber, strokes>> (net only).
 * @param scoreMode       'gross' or 'net'.
 */
export function computeStablefordLive(
  holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
  handicapStrokes: Map<string, Map<number, number>>,
  scoreMode: 'gross' | 'net',
): Map<string, StablefordLiveEntry> {
  const result = new Map<string, StablefordLiveEntry>();

  for (const h of holes) {
    const holeScores = allScores.get(h.number);
    if (!holeScores) continue;

    holeScores.forEach((s, playerId) => {
      if (typeof s.gross !== 'number') return; // hole not scored for this player

      const strokes = scoreMode === 'net'
        ? (handicapStrokes.get(playerId)?.get(h.number) ?? 0)
        : 0;
      const pts = calculateStablefordPoints(s.gross, h.par, strokes);

      const prev = result.get(playerId) ?? { points: 0, thru: 0 };
      result.set(playerId, { points: prev.points + pts, thru: prev.thru + 1 });
    });
  }

  return result;
}

export type StablefordLeaderboardRow = {
  playerId: string;
  points: number;
  thru: number;
};

/**
 * Rank the full roster for a live Stableford leaderboard (Stage 3).
 *
 * Ordering contract:
 *   1. Unscored players (thru === 0) always rank BELOW scored players, in
 *      roster order. The discriminator is thru, NOT points — in Stableford an
 *      earned zero (holes played, no points) is a real score and outranks a
 *      player who hasn't teed off.
 *   2. Scored players sort by points DESC.
 *   3. Ties break by roster index — deliberately NOT by thru. A thru-based
 *      tiebreak reorders tied players on any 0-point hole (points unchanged,
 *      thru incremented); roster index is fixed for the round, so tied
 *      players hold their relative order hole over hole.
 *
 * Every roster id appears in the result exactly once; ids absent from
 * `entries` come back as { points: 0, thru: 0 }.
 */
export function rankStablefordLive(
  rosterIds: string[],
  entries: Map<string, StablefordLiveEntry>,
): StablefordLeaderboardRow[] {
  return rosterIds
    .map((id, idx) => {
      const e = entries.get(id);
      return { playerId: id, points: e?.points ?? 0, thru: e?.thru ?? 0, idx };
    })
    .sort((a, b) => {
      const aUnscored = a.thru === 0;
      const bUnscored = b.thru === 0;
      if (aUnscored !== bUnscored) return aUnscored ? 1 : -1;
      if (b.points !== a.points) return b.points - a.points;
      return a.idx - b.idx;
    })
    .map(({ playerId, points, thru }) => ({ playerId, points, thru }));
}
