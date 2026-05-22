/**
 * Poker Service Tests — Hand Evaluation
 *
 * Covers evaluateBestHand (which delegates to private evaluateFive for
 * exactly 5 cards, evaluatePartial for <5 cards, and combinations-of-5
 * for >5 cards) + compareEvaluations. The evaluator underpins 3-Putt
 * Poker and the cinematic Royal/Straight/Quads moments — zero tests
 * prior to this file.
 *
 * Run standalone:
 *   npx ts-node --skip-project --compiler-options '{"module":"commonjs","target":"es2020","esModuleInterop":true,"moduleResolution":"node"}' src/services/__tests__/poker.service.test.ts
 */

import {
  evaluateBestHand,
  compareEvaluations,
  type Card,
  type Suit,
  type Rank,
  type HandEvaluation,
  type PokerHandRank,
} from '../poker.service';

// ─── Test Runner (works without jest) ───────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function describe(name: string, fn: () => void) {
  console.log(`\n  ${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`    ✓ ${name}`);
  } catch (e: any) {
    failed++;
    const msg = `    ✗ ${name}: ${e.message}`;
    console.log(msg);
    failures.push(msg);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
  };
}

// ─── Card construction helper ───────────────────────────────────────────

// Compact "Ah" / "Td" / "5s" notation → Card. Uppercase rank, lowercase suit.
// T = 10. Rank chars: 2-9, T, J, Q, K, A. Suit chars: h, d, c, s.
function c(notation: string): Card {
  const rankChar = notation.slice(0, -1).toUpperCase();
  const suitChar = notation.slice(-1).toLowerCase();
  const rank: Rank = (rankChar === 'T' ? '10' : rankChar) as Rank;
  const value = rank === 'A' ? 14
    : rank === 'K' ? 13
    : rank === 'Q' ? 12
    : rank === 'J' ? 11
    : Number(rank);
  const suit: Suit = suitChar === 'h' ? 'hearts'
    : suitChar === 'd' ? 'diamonds'
    : suitChar === 'c' ? 'clubs'
    : 'spades';
  return { suit, rank, value };
}
function hand(...notations: string[]): Card[] {
  return notations.map(c);
}

function rankOf(cards: Card[]): PokerHandRank | null {
  const ev = evaluateBestHand(cards);
  return ev ? ev.rank : null;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('evaluateFive (via evaluateBestHand with 5 cards) — all 10 ranks', () => {
  it('E.1: royal flush — A-K-Q-J-10 same suit', () => {
    const ev = evaluateBestHand(hand('Ah', 'Kh', 'Qh', 'Jh', 'Th'))!;
    expect(ev.rank).toBe('royal_flush');
    expect(ev.rankValue).toBe(10);
    expect(ev.label).toBe('Royal Flush');
  });
  it('E.2: straight flush — 9-8-7-6-5 same suit (not royal)', () => {
    const ev = evaluateBestHand(hand('9c', '8c', '7c', '6c', '5c'))!;
    expect(ev.rank).toBe('straight_flush');
    expect(ev.tiebreakers).toEqual([9]); // straightHigh
  });
  it('E.3: wheel straight flush — A-2-3-4-5 same suit, straightHigh=5 (NOT royal)', () => {
    const ev = evaluateBestHand(hand('As', '2s', '3s', '4s', '5s'))!;
    expect(ev.rank).toBe('straight_flush');
    expect(ev.tiebreakers).toEqual([5]); // Ace plays low → 5-high
  });
  it('E.4: four of a kind', () => {
    const ev = evaluateBestHand(hand('Kh', 'Kd', 'Kc', 'Ks', '3h'))!;
    expect(ev.rank).toBe('four_of_kind');
    // tiebreakers: [quad value, kicker value]
    expect(ev.tiebreakers).toEqual([13, 3]);
  });
  it('E.5: full house — kings over twos', () => {
    const ev = evaluateBestHand(hand('Kh', 'Kd', 'Kc', '2s', '2h'))!;
    expect(ev.rank).toBe('full_house');
    expect(ev.tiebreakers).toEqual([13, 2]); // trips first, pair second
  });
  it('E.6: flush — all hearts, no straight', () => {
    const ev = evaluateBestHand(hand('Ah', 'Jh', '8h', '5h', '2h'))!;
    expect(ev.rank).toBe('flush');
    // tiebreakers = all 5 values descending
    expect(ev.tiebreakers).toEqual([14, 11, 8, 5, 2]);
  });
  it('E.7: straight — 6-5-4-3-2 mixed suits', () => {
    const ev = evaluateBestHand(hand('6h', '5d', '4c', '3s', '2h'))!;
    expect(ev.rank).toBe('straight');
    expect(ev.tiebreakers).toEqual([6]);
  });
  it('E.8: wheel straight — A-2-3-4-5 mixed suits, straightHigh=5', () => {
    const ev = evaluateBestHand(hand('Ah', '2d', '3c', '4s', '5h'))!;
    expect(ev.rank).toBe('straight');
    expect(ev.tiebreakers).toEqual([5]);
  });
  it('E.9: three of a kind — trip 7s with K + 4 kickers', () => {
    const ev = evaluateBestHand(hand('7h', '7d', '7c', 'Kh', '4s'))!;
    expect(ev.rank).toBe('three_of_kind');
    expect(ev.tiebreakers).toEqual([7, 13, 4]);
  });
  it('E.10: two pair — kings over fives, with ace kicker', () => {
    const ev = evaluateBestHand(hand('Kh', 'Kd', '5c', '5s', 'Ah'))!;
    expect(ev.rank).toBe('two_pair');
    expect(ev.tiebreakers).toEqual([13, 5, 14]); // top pair, bottom pair, kicker
  });
  it('E.11: pair — pair of nines with K-7-2 kickers', () => {
    const ev = evaluateBestHand(hand('9h', '9d', 'Kc', '7s', '2h'))!;
    expect(ev.rank).toBe('pair');
    expect(ev.tiebreakers).toEqual([9, 13, 7, 2]);
  });
  it('E.12: high card — A-J-9-5-3', () => {
    const ev = evaluateBestHand(hand('Ah', 'Jd', '9c', '5s', '3h'))!;
    expect(ev.rank).toBe('high_card');
    expect(ev.tiebreakers).toEqual([14, 11, 9, 5, 3]);
  });
});

describe('Tiebreakers — same-rank hand comparisons', () => {
  it('T.1: pair vs pair → kicker decides', () => {
    // Both pair of 5s. A beats K kicker.
    const a = evaluateBestHand(hand('5h', '5d', 'Ah', '7c', '2s'))!;
    const b = evaluateBestHand(hand('5c', '5s', 'Kh', '7d', '2c'))!;
    expect(compareEvaluations(a, b) > 0).toBe(true);
  });
  it('T.2: two pair — same top pair, different bottom pair', () => {
    // K+K + 9+9 + X  vs  K+K + 7+7 + X. First hand wins.
    const a = evaluateBestHand(hand('Kh', 'Kd', '9c', '9s', '2h'))!;
    const b = evaluateBestHand(hand('Kc', 'Ks', '7h', '7d', '2c'))!;
    expect(compareEvaluations(a, b) > 0).toBe(true);
  });
  it('T.3: two pair — both pairs identical, 5th-card kicker decides', () => {
    // K+K + 9+9 + A vs K+K + 9+9 + 2.
    const a = evaluateBestHand(hand('Kh', 'Kd', '9c', '9s', 'Ah'))!;
    const b = evaluateBestHand(hand('Kc', 'Ks', '9h', '9d', '2c'))!;
    expect(compareEvaluations(a, b) > 0).toBe(true);
  });
  it('T.4: three of a kind — different trips → higher trip wins', () => {
    const a = evaluateBestHand(hand('Qh', 'Qd', 'Qc', '5s', '2h'))!;
    const b = evaluateBestHand(hand('Jh', 'Jd', 'Jc', 'As', 'Kh'))!; // J trip but better kickers
    expect(compareEvaluations(a, b) > 0).toBe(true); // Q trip > J trip regardless of kickers
  });
  it('T.5: flush vs flush → high card decides', () => {
    // A-high flush vs K-high flush
    const a = evaluateBestHand(hand('Ah', 'Jh', '8h', '5h', '2h'))!;
    const b = evaluateBestHand(hand('Kc', 'Jc', '8c', '5c', '2c'))!;
    expect(compareEvaluations(a, b) > 0).toBe(true);
  });
  it('T.6: straight vs straight — higher straight wins', () => {
    // 9-high straight vs 8-high straight
    const a = evaluateBestHand(hand('9h', '8d', '7c', '6s', '5h'))!;
    const b = evaluateBestHand(hand('8h', '7d', '6c', '5s', '4h'))!;
    expect(compareEvaluations(a, b) > 0).toBe(true);
  });
  it('T.7: wheel straight (5-high) LOSES to 6-high straight', () => {
    // Wheel's straightHigh = 5; 6-high beats it
    const wheel = evaluateBestHand(hand('Ah', '2d', '3c', '4s', '5h'))!;
    const sixHigh = evaluateBestHand(hand('6h', '5d', '4c', '3s', '2h'))!;
    expect(compareEvaluations(sixHigh, wheel) > 0).toBe(true);
    expect(wheel.tiebreakers).toEqual([5]);
    expect(sixHigh.tiebreakers).toEqual([6]);
  });
});

describe('evaluateBestHand — 6 and 7 card best-of selection', () => {
  it('B.6Q: 6 cards including quads → returns four_of_kind', () => {
    const ev = evaluateBestHand(hand('Kh', 'Kd', 'Kc', 'Ks', '7h', '3d'))!;
    expect(ev.rank).toBe('four_of_kind');
    expect(ev.tiebreakers).toEqual([13, 7]); // best kicker = 7, not 3
  });
  it('B.7F: 7 cards with a 5-of-a-suit flush → returns flush with the 5 same-suit cards', () => {
    // Five hearts (A-J-8-5-2) + two non-hearts. Best 5-card is the flush.
    const ev = evaluateBestHand(hand('Ah', 'Jh', '8h', '5h', '2h', 'Kd', 'Qc'))!;
    expect(ev.rank).toBe('flush');
    // All 5 best cards should be hearts
    expect(ev.bestFive.every((card) => card.suit === 'hearts')).toBe(true);
  });
  it('B.6P: 6 cards with one pair → bestFive uses the pair + top 3 kickers', () => {
    // Pair of 5s + A, K, 9, 3. Kickers should be A, K, 9 (not 3).
    const ev = evaluateBestHand(hand('5h', '5d', 'Ah', 'Kc', '9s', '3d'))!;
    expect(ev.rank).toBe('pair');
    expect(ev.tiebreakers).toEqual([5, 14, 13, 9]);
  });
  it('B.7S: 7 cards with a straight in 5 of them → returns straight', () => {
    // 9-8-7-6-5 straight + two unrelated higher cards (K, 3).
    const ev = evaluateBestHand(hand('9h', '8d', '7c', '6s', '5h', 'Kd', '3c'))!;
    expect(ev.rank).toBe('straight');
    expect(ev.tiebreakers).toEqual([9]);
  });
  it('B.7K: 7 cards no pattern → high_card, top 5 by value', () => {
    // A, J, 9, 7, 5, 3, 2 → top 5 = A, J, 9, 7, 5
    const ev = evaluateBestHand(hand('Ah', 'Jd', '9c', '7s', '5h', '3d', '2c'))!;
    expect(ev.rank).toBe('high_card');
    expect(ev.tiebreakers).toEqual([14, 11, 9, 7, 5]);
  });
  it('B.7SF: 7 cards containing a straight flush → returns straight_flush over flush+straight', () => {
    // 9c-8c-7c-6c-5c (straight flush) + Ah + Kd
    const ev = evaluateBestHand(hand('9c', '8c', '7c', '6c', '5c', 'Ah', 'Kd'))!;
    expect(ev.rank).toBe('straight_flush');
  });
});

describe('evaluateBestHand — partial hands (<5 cards)', () => {
  it('P.0: empty array → null', () => {
    expect(evaluateBestHand([])).toBe(null);
  });
  it('P.1: 1 card → high_card', () => {
    const ev = evaluateBestHand(hand('Ah'))!;
    expect(ev.rank).toBe('high_card');
    expect(ev.tiebreakers).toEqual([14]);
  });
  it('P.2pair: 2 cards same value → pair', () => {
    const ev = evaluateBestHand(hand('Ah', 'Ad'))!;
    expect(ev.rank).toBe('pair');
  });
  it('P.2hi: 2 different cards → high_card', () => {
    const ev = evaluateBestHand(hand('Ah', 'Kd'))!;
    expect(ev.rank).toBe('high_card');
    expect(ev.tiebreakers).toEqual([14, 13]);
  });
  it('P.3trip: 3 cards same value → three_of_kind', () => {
    const ev = evaluateBestHand(hand('7h', '7d', '7c'))!;
    expect(ev.rank).toBe('three_of_kind');
  });
  it('P.3pair: 3 cards with a pair → pair', () => {
    const ev = evaluateBestHand(hand('7h', '7d', '2c'))!;
    expect(ev.rank).toBe('pair');
  });
  it('P.4quads: 4 cards same value → four_of_kind (partial)', () => {
    const ev = evaluateBestHand(hand('Kh', 'Kd', 'Kc', 'Ks'))!;
    expect(ev.rank).toBe('four_of_kind');
  });
  it('P.4trips: 4 cards with three of a kind → three_of_kind', () => {
    const ev = evaluateBestHand(hand('Kh', 'Kd', 'Kc', '5s'))!;
    expect(ev.rank).toBe('three_of_kind');
  });
  it('P.4fh: 4 cards with three + pair pattern is impossible (needs 5) → top is trips when 3+1', () => {
    // 4 cards Kh-Kd-Kc-5s: trips with kicker. Not a full house (would need 3+2 = 5 cards).
    const ev = evaluateBestHand(hand('Kh', 'Kd', 'Kc', '5s'))!;
    expect(ev.rank).toBe('three_of_kind');
  });
  it('P.4twopair: 4 cards as two pairs → two_pair (partial)', () => {
    const ev = evaluateBestHand(hand('Kh', 'Kd', '5c', '5s'))!;
    expect(ev.rank).toBe('two_pair');
  });
  it('P.straightless: partial does NOT detect straights or flushes (needs 5 cards)', () => {
    // 4 cards 5h-4h-3h-2h: would be straight flush at 5 cards. Partial sees only high_card.
    const ev = evaluateBestHand(hand('5h', '4h', '3h', '2h'))!;
    expect(ev.rank).toBe('high_card');
  });
});

describe('compareEvaluations — sign semantics', () => {
  it('C.1: different ranks → sign reflects rank value (positive when a > b)', () => {
    const royal = evaluateBestHand(hand('Ah', 'Kh', 'Qh', 'Jh', 'Th'))!;
    const pair = evaluateBestHand(hand('5h', '5d', 'Ah', 'Kc', '2s'))!;
    expect(compareEvaluations(royal, pair) > 0).toBe(true);
    expect(compareEvaluations(pair, royal) < 0).toBe(true);
  });
  it('C.2: same rank, different first tiebreaker → first tiebreaker decides', () => {
    // Both flush; A-high vs K-high
    const aFlush = evaluateBestHand(hand('Ah', 'Jh', '8h', '5h', '2h'))!;
    const kFlush = evaluateBestHand(hand('Kc', 'Jc', '8c', '5c', '2c'))!;
    expect(compareEvaluations(aFlush, kFlush) > 0).toBe(true);
  });
  it('C.3: identical hands → 0', () => {
    const a = evaluateBestHand(hand('Ah', 'Kh', '5d', '5c', '2s'))!;
    const b = evaluateBestHand(hand('Ad', 'Kd', '5s', '5h', '2c'))!;
    // Both are pair of 5s with A-K-2 kickers (suits don't matter for ranking)
    expect(compareEvaluations(a, b)).toBe(0);
  });
});

// ─── Report ─────────────────────────────────────────────────────────────

console.log(`\n  ─────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log(`\n  Failures:`);
  failures.forEach((f) => console.log(f));
}
console.log('');

if (failed > 0) process.exit(1);
