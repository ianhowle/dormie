// ─── Match Play family — post-round result resolution ───────────────
// JSX-free + supabase-free so it imports cleanly under ts-node (same
// pattern as src/scoring/gir.ts). Consumed by PostRoundSummary for the
// match-play post-round result; tested directly in scoring-formats.test.ts.
//
// WHY THIS EXISTS (the clinch-drift bug it fixes):
// The Layer-B engine `formatMatchState` computes from CURRENT accumulated
// totals. If the user keeps entering scores AFTER the match is mathematically
// decided, its `finalDisplay` drifts — e.g. a match clinched 3&2 on hole 16,
// then holes 17-18 are entered with the trailer winning both, makes the engine
// emit "1 UP" (doubly wrong: it was 3&2, and the match was already over).
//
// This helper instead walks holes IN ORDER and FREEZES the result at the first
// hole where the lead exceeds the holes remaining (the close-out). Holes played
// past that point cannot change the result. The engine is left untouched — the
// live banner uses `currentDisplay` correctly; this is post-round-display-only.

import type { HoleData, HoleScore } from './types';
import { deriveSinglesSideScore } from '../data/scoring';

export type MatchResult = {
  /** Winning side, or null for a halved match. */
  leader: 'A' | 'B' | null;
  /** Post-round form: "3&2" (closed out early), "1 UP" (to the last), "HALVED". */
  display: string;
  /** True when the match closed out before the final hole. */
  clinchedEarly: boolean;
  /** Hole number the match closed out on, or null if it went the distance / halved. */
  clinchHole: number | null;
};

/**
 * Resolve the FINAL 1v1 singles match result, immune to scores entered past
 * the close-out hole.
 *
 * Walks `holes` in array order (the play order), deriving each side's per-hole
 * score via `deriveSinglesSideScore` (gross, or net per `scoreMode`). After each
 * completed hole it checks the close-out condition `lead > holesRemaining`: the
 * FIRST hole that satisfies it freezes the result as "lead&remaining" and the
 * walk stops. If no hole closes out early, the result is the final-hole margin
 * ("N UP", or "HALVED" when level).
 *
 * @param sideAPlayerId  Player id for side A.
 * @param sideBPlayerId  Player id for side B.
 * @param holes          Holes in play order (length defines totalHoles).
 * @param allScores      Live scores: Map<holeNumber, Map<playerId, HoleScore>>.
 * @param scoreMode      'gross' or 'net' (net subtracts per-hole handicap strokes).
 * @param handicapStrokes Map<playerId, Map<holeNumber, strokes>> (net only).
 */
export function resolveMatchResult(
  sideAPlayerId: string,
  sideBPlayerId: string,
  holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
  scoreMode: 'gross' | 'net',
  handicapStrokes: Map<string, Map<number, number>>,
): MatchResult {
  const totalHoles = holes.length;
  let wonA = 0;
  let wonB = 0;
  let played = 0;

  for (const h of holes) {
    const holeScores = allScores.get(h.number);
    if (!holeScores) continue;
    const grossA = holeScores.get(sideAPlayerId)?.gross;
    const grossB = holeScores.get(sideBPlayerId)?.gross;

    const strokesA = scoreMode === 'net' ? (handicapStrokes.get(sideAPlayerId)?.get(h.number) ?? 0) : 0;
    const strokesB = scoreMode === 'net' ? (handicapStrokes.get(sideBPlayerId)?.get(h.number) ?? 0) : 0;
    const sideA = deriveSinglesSideScore(grossA, strokesA);
    const sideB = deriveSinglesSideScore(grossB, strokesB);
    if (sideA === null || sideB === null) continue; // hole not complete for both sides

    played++;
    if (sideA < sideB) wonA++;
    else if (sideB < sideA) wonB++;
    // halved hole: neither counter moves; `played` still advances.

    const lead = Math.abs(wonA - wonB);
    const remaining = totalHoles - played;
    // Close-out: lead exceeds what's left to play. `remaining > 0` so a decisive
    // FINAL hole reads "N UP", not "N&0".
    if (remaining > 0 && lead > remaining) {
      return {
        leader: wonA > wonB ? 'A' : 'B',
        display: `${lead}&${remaining}`,
        clinchedEarly: true,
        clinchHole: h.number,
      };
    }
  }

  // No early close-out — went to the final entered hole (or halved).
  const lead = Math.abs(wonA - wonB);
  if (lead === 0) {
    return { leader: null, display: 'HALVED', clinchedEarly: false, clinchHole: null };
  }
  return {
    leader: wonA > wonB ? 'A' : 'B',
    display: `${lead} UP`,
    clinchedEarly: false,
    clinchHole: null,
  };
}
