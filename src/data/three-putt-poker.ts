// ─── 3-Putt Poker round engine ───────────────────────────────────────
// Pure, deterministic, deck-as-input. Encodes the CURRENT live mechanic
// (good putting earns cards, bad putting feeds the pot, last 3-putter
// holds a cosmetic chip-of-shame, best 5-card hand wins the pot) — NOT
// the stale doc-spec at src/data/scoring.ts:492-503 which describes the
// inverted incentive (3-putts deal cards, worst hand pays). The doc is
// wrong; the code is what ships. Flagged for separate doc fix.
//
// The engine never calls Math.random — callers (live screen, tests)
// pass a Card[] deck. Dormie Moment side-effects (royal/straight-flush/
// quads triggers) are caller-owned: the engine returns evaluations, the
// caller diffs against a prior result to detect threshold crossings.

import type { Card, HandEvaluation } from '../services/poker.service';
import { evaluateBestHand, compareEvaluations } from '../services/poker.service';
import type { HoleScore, HoleData } from '../scoring/types';

/**
 * Cards dealt to a player for a single hole, per the current mechanic.
 * Chip-in (holed out without putting) → 2 cards. One-putt → 1 card.
 * Two-putt or worse → 0 cards. Empty hole (no shots logged) → 0.
 */
export function cardsToDealForHole(hs: { putts: number; gross: number }): number {
  const chipIn = hs.putts === 0 && hs.gross > 0;
  if (chipIn) return 2;
  if (hs.putts === 1) return 1;
  return 0;
}

type ScoreMap = Map<number, Map<string, HoleScore>>;

function countWhere(
  scores: ScoreMap,
  predicate: (hs: HoleScore) => boolean,
): Map<string, number> {
  const counts = new Map<string, number>();
  scores.forEach((perPlayer) => {
    perPlayer.forEach((hs, pid) => {
      if (predicate(hs)) counts.set(pid, (counts.get(pid) ?? 0) + 1);
    });
  });
  return counts;
}

export function countThreePutts(scores: ScoreMap): Map<string, number> {
  return countWhere(scores, (hs) => hs.putts >= 3);
}

export function countOnePutts(scores: ScoreMap): Map<string, number> {
  return countWhere(scores, (hs) => hs.putts === 1);
}

export function countChipIns(scores: ScoreMap): Map<string, number> {
  return countWhere(scores, (hs) => hs.putts === 0 && hs.gross > 0);
}

/**
 * Total pot: per-player ante seed + sum of 3-putt penalties.
 * Penalty per hole = max(0, putts - 2) × threePuttPenalty, so a 4-putt
 * contributes 2× the per-extra-putt rate.
 */
export function computePot(args: {
  playerCount: number;
  ante: number;
  threePuttPenalty: number;
  scores: ScoreMap;
}): number {
  let pot = args.playerCount * args.ante;
  args.scores.forEach((perPlayer) => {
    perPlayer.forEach((hs) => {
      const extra = Math.max(0, hs.putts - 2);
      pot += extra * args.threePuttPenalty;
    });
  });
  return pot;
}

/**
 * Chip-of-shame holder = the LAST player to 3-putt as the round is
 * walked in hole order × playerIds order. Cosmetic only; does not
 * affect payouts. Returns null if no one 3-putted.
 *
 * Tiebreak within a hole = last playerId in the supplied order. This
 * mirrors the live useScoringState behavior (`players.forEach` after
 * `holes.forEach`, with `newWorstPutter = p.id` overwriting).
 */
export function computeWorstPutter(
  scores: ScoreMap,
  holesInOrder: HoleData[],
  playerIds: string[],
): string | null {
  let last: string | null = null;
  for (const h of holesInOrder) {
    const perPlayer = scores.get(h.number);
    if (!perPlayer) continue;
    for (const pid of playerIds) {
      const hs = perPlayer.get(pid);
      if (hs && hs.putts >= 3) last = pid;
    }
  }
  return last;
}

/**
 * Walk holes × players in order and assign cards from the front of
 * the deck. Engine is pure: same deck + same scores → same assignment.
 * Runs out of cards = stops dealing (defensive; a real 52-card deck
 * is large enough that this only fires in pathological tests).
 */
export function dealCards(args: {
  scores: ScoreMap;
  holesInOrder: HoleData[];
  playerIds: string[];
  deck: Card[];
}): { perPlayer: Map<string, Card[]>; deckCursor: number } {
  const { scores, holesInOrder, playerIds, deck } = args;
  const perPlayer = new Map<string, Card[]>();
  for (const pid of playerIds) perPlayer.set(pid, []);
  let cursor = 0;

  for (const h of holesInOrder) {
    const holeScores = scores.get(h.number);
    if (!holeScores) continue;
    for (const pid of playerIds) {
      const hs = holeScores.get(pid);
      if (!hs) continue;
      const n = cardsToDealForHole(hs);
      for (let i = 0; i < n; i++) {
        if (cursor >= deck.length) return { perPlayer, deckCursor: cursor };
        perPlayer.get(pid)!.push(deck[cursor++]);
      }
    }
  }
  return { perPlayer, deckCursor: cursor };
}

export type PokerPerPlayerResult = {
  cards: Card[];
  onePutts: number;
  chipIns: number;
  threePutts: number;
  evaluation: HandEvaluation | null;
};

/**
 * Signed per-player ledger. Convention: payouts net to zero.
 *
 * Winner exists: winner = +pot; each player (winner included) is
 * debited their contribution (ante + own 3-putt penalties). Net for
 * the winner = pot - their own contribution; net for others =
 * -(their own contribution). Σ = 0 because Σ contributions = pot.
 *
 * Winner is null (no one earned any cards — round had zero one-putts
 * and zero chip-ins): pot is voided/refunded, payouts are 0 for all.
 * Σ = 0.
 */
export type PokerRoundResult = {
  perPlayer: Map<string, PokerPerPlayerResult>;
  pot: number;
  worstPutter: string | null;
  ranked: Array<{ playerId: string; evaluation: HandEvaluation | null }>;
  winnerId: string | null;
  payouts: Map<string, number>;
};

export function evaluatePokerRound(args: {
  scores: ScoreMap;
  holesInOrder: HoleData[];
  playerIds: string[];
  deck: Card[];
  ante: number;
  threePuttPenalty: number;
}): PokerRoundResult {
  const { scores, holesInOrder, playerIds, deck, ante, threePuttPenalty } = args;

  const threePutts = countThreePutts(scores);
  const onePutts = countOnePutts(scores);
  const chipIns = countChipIns(scores);
  const { perPlayer: cardsPerPlayer } = dealCards({ scores, holesInOrder, playerIds, deck });
  const pot = computePot({ playerCount: playerIds.length, ante, threePuttPenalty, scores });
  const worstPutter = computeWorstPutter(scores, holesInOrder, playerIds);

  const perPlayer = new Map<string, PokerPerPlayerResult>();
  for (const pid of playerIds) {
    const cards = cardsPerPlayer.get(pid) ?? [];
    perPlayer.set(pid, {
      cards,
      onePutts: onePutts.get(pid) ?? 0,
      chipIns: chipIns.get(pid) ?? 0,
      threePutts: threePutts.get(pid) ?? 0,
      evaluation: evaluateBestHand(cards),
    });
  }

  const ranked = playerIds
    .map((pid) => ({ playerId: pid, evaluation: perPlayer.get(pid)!.evaluation }))
    .sort((a, b) => {
      if (!a.evaluation && !b.evaluation) return 0;
      if (!a.evaluation) return 1;
      if (!b.evaluation) return -1;
      return -compareEvaluations(a.evaluation, b.evaluation);
    });

  const winnerId = ranked[0]?.evaluation ? ranked[0].playerId : null;

  const payouts = new Map<string, number>();
  if (winnerId === null) {
    for (const pid of playerIds) payouts.set(pid, 0);
  } else {
    const penaltiesByPlayer = new Map<string, number>();
    for (const pid of playerIds) penaltiesByPlayer.set(pid, 0);
    scores.forEach((perPlayerMap) => {
      perPlayerMap.forEach((hs, pid) => {
        const extra = Math.max(0, hs.putts - 2);
        if (extra > 0) {
          penaltiesByPlayer.set(pid, (penaltiesByPlayer.get(pid) ?? 0) + extra * threePuttPenalty);
        }
      });
    });
    for (const pid of playerIds) {
      const contributed = ante + (penaltiesByPlayer.get(pid) ?? 0);
      const received = winnerId === pid ? pot : 0;
      payouts.set(pid, received - contributed);
    }
  }

  return { perPlayer, pot, worstPutter, ranked, winnerId, payouts };
}
