/**
 * Scoring Formats 1–6 Tests
 *
 * Tests calculation correctness for the first six scoring formats:
 *   1. Stableford (standard)
 *   2. Modified Stableford (aggressive)
 *   3. Stroke Play Net
 *   4. Stroke Play Gross
 *   5. Quota
 *   6. Best 9
 *
 * Run with:
 *   ts-node --skip-project --compiler-options '{"module":"commonjs","target":"es2020","esModuleInterop":true,"moduleResolution":"node"}' src/data/__tests__/scoring-formats.test.ts
 */

// Import pure functions from modules that don't pull in Supabase/RN
import {
  calculateStablefordPoints,
  calculateNetStablefordTotal,
  calculateModifiedStablefordPoints,
  calculateModifiedStablefordFromRound,
  calculateBestNHoles,
  calculateMatchPlay,
  calculateNetMatchPlay,
  formatMatchState,
  deriveSinglesSideScore,
  calculateBestBall,
  calculateNetBestBall,
  calculateScrambleTeamScore,
  validateScrambleScore,
  calculateChapmanHoleScore,
  calculateChapmanTotal,
  type ChapmanHoleScore,
  calculateArniesCount,
  calculateHogansCount,
  calculateTrashTotal,
  calculateSandiesCount,
  calculateBarkiesCount,
  calculatePoleysCount,
  POLEYS_THRESHOLD_FEET,
  type SideGameBooleanSlice,
  type SideGameNumericSlice,
} from '../scoring';
import type { HoleScore, HoleData } from '../../scoring/types';
import type { Card } from '../../services/poker.service';
import { checkDormieMoments } from '../../scoring/moments';
import { resolveMatchResult } from '../../scoring/matchplay-result';
import { computeStablefordLive, rankStablefordLive } from '../../scoring/stableford-live';
import {
  cardsToDealForHole,
  countThreePutts,
  countOnePutts,
  countChipIns,
  computePot,
  computeWorstPutter,
  dealCards,
  evaluatePokerRound,
} from '../three-putt-poker';
import {
  calculateTeamHandicap,
  teamHandicapForFormat,
  TEAM_HANDICAP_PRESETS,
  type TeamHandicapRule,
} from '../team-handicap';

// ─── Test helpers for Tier A side-game counters ───────────────────────
// Constructs the Map<holeNumber, Map<playerId, HoleScore>> shape used by
// the live scoring path. Tests build small synthetic rounds inline.
function makeHole(number: number, par: number, strokeIndex = 1): HoleData {
  return { number, par, strokeIndex };
}
function makeScore(gross: number, putts: number, fir: boolean | null): HoleScore {
  return { gross, putts, fir };
}
function makeAllScores(
  rows: Array<{ hole: number; playerId: string; score: HoleScore }>,
): Map<number, Map<string, HoleScore>> {
  const m = new Map<number, Map<string, HoleScore>>();
  for (const r of rows) {
    if (!m.has(r.hole)) m.set(r.hole, new Map());
    m.get(r.hole)!.set(r.playerId, r.score);
  }
  return m;
}

import { quotaTarget, quotaResult } from '../../lib/scoring-utils';

// Inline pure functions from services that depend on supabase imports
// These are copies of the exact same logic from scoring.service.ts and handicap.service.ts

function calculateStablefordFromRound(holeScores: number[], coursePars: number[]): number {
  const len = Math.min(holeScores.length, coursePars.length);
  let total = 0;
  for (let i = 0; i < len; i++) {
    const diff = holeScores[i] - coursePars[i];
    if (diff >= 2) total += 0;
    else if (diff === 1) total += 1;
    else if (diff === 0) total += 2;
    else if (diff === -1) total += 3;
    else if (diff === -2) total += 4;
    else total += 5;
  }
  return total;
}

function calculateCourseHandicap(handicapIndex: number, slopeRating: number, courseRating: number, par: number): number {
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - par));
}

function calculateNetScore(grossScore: number, courseHandicap: number): number {
  return grossScore - courseHandicap;
}

// ─── Test Runner ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];
const results: { step: string; input: string; expected: string; actual: string; pass: boolean }[] = [];

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
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(n: number) {
      if ((actual as number) <= n) throw new Error(`Expected > ${n}, got ${actual}`);
    },
    toBeLessThan(n: number) {
      if ((actual as number) >= n) throw new Error(`Expected < ${n}, got ${actual}`);
    },
  };
}

function record(step: string, input: string, expected: string, actual: string, pass: boolean) {
  results.push({ step, input, expected, actual, pass });
}

// ─── Test Data ────────────────────────────────────────────────────────

// Front 9: all par 4 holes
const FRONT_9_PARS = [4, 4, 4, 4, 4, 4, 4, 4, 4];
const FRONT_9_SCORES = [4, 5, 3, 6, 4, 4, 5, 3, 4]; // par, bogey, birdie, dbl, par, par, bogey, birdie, par

// Full 18 with mixed pars
const FULL_18_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
const FULL_18_SCORES = [4, 5, 3, 6, 4, 4, 5, 3, 4, 5, 5, 2, 4, 5, 4, 3, 5, 4];

// ═══════════════════════════════════════════════════════════════════════
console.log('\n========================================');
console.log('  Scoring Formats 1–6 Tests');
console.log('========================================');

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 1: STABLEFORD
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 1: STABLEFORD', () => {
  it('1.1: Per-hole points — double bogey+ = 0', () => {
    const pts = calculateStablefordPoints(6, 4, 0);
    record('1.1', 'Score 6, Par 4 (double bogey)', '0', String(pts), pts === 0);
    expect(pts).toBe(0);
  });

  it('1.2: Per-hole points — bogey = 1', () => {
    const pts = calculateStablefordPoints(5, 4, 0);
    record('1.2', 'Score 5, Par 4 (bogey)', '1', String(pts), pts === 1);
    expect(pts).toBe(1);
  });

  it('1.3: Per-hole points — par = 2', () => {
    const pts = calculateStablefordPoints(4, 4, 0);
    record('1.3', 'Score 4, Par 4 (par)', '2', String(pts), pts === 2);
    expect(pts).toBe(2);
  });

  it('1.4: Per-hole points — birdie = 3', () => {
    const pts = calculateStablefordPoints(3, 4, 0);
    record('1.4', 'Score 3, Par 4 (birdie)', '3', String(pts), pts === 3);
    expect(pts).toBe(3);
  });

  it('1.5: Per-hole points — eagle = 4', () => {
    const pts = calculateStablefordPoints(2, 4, 0);
    record('1.5', 'Score 2, Par 4 (eagle)', '4', String(pts), pts === 4);
    expect(pts).toBe(4);
  });

  it('1.6: Per-hole points — albatross = 5', () => {
    const pts = calculateStablefordPoints(1, 4, 0);
    record('1.6', 'Score 1, Par 4 (albatross)', '5', String(pts), pts === 5);
    expect(pts).toBe(5);
  });

  it('1.7: Per-hole points — triple bogey = 0 (same as double+)', () => {
    const pts = calculateStablefordPoints(7, 4, 0);
    record('1.7', 'Score 7, Par 4 (triple bogey)', '0', String(pts), pts === 0);
    expect(pts).toBe(0);
  });

  it('1.8: Front 9 total — scores [4,5,3,6,4,4,5,3,4] on par 4s', () => {
    const total = calculateStablefordFromRound(FRONT_9_SCORES, FRONT_9_PARS);
    const expectedPerHole = [2, 1, 3, 0, 2, 2, 1, 3, 2];
    const expectedTotal = 16;
    record('1.8', 'Scores [4,5,3,6,4,4,5,3,4] on par 4s', `[${expectedPerHole}] = ${expectedTotal}`, String(total), total === expectedTotal);
    expect(total).toBe(expectedTotal);
  });

  it('1.9: Verify individual hole points match expected array', () => {
    const expectedPerHole = [2, 1, 3, 0, 2, 2, 1, 3, 2];
    for (let i = 0; i < 9; i++) {
      const pts = calculateStablefordPoints(FRONT_9_SCORES[i], FRONT_9_PARS[i], 0);
      expect(pts).toBe(expectedPerHole[i]);
    }
  });

  it('1.10: Net Stableford with handicap strokes (1 stroke on bogey hole → par)', () => {
    const pts = calculateStablefordPoints(5, 4, 1);
    record('1.10', 'Score 5, Par 4, 1 HCP stroke (net par)', '2', String(pts), pts === 2);
    expect(pts).toBe(2);
  });

  it('1.11: Par 3 and Par 5 holes', () => {
    expect(calculateStablefordPoints(2, 3, 0)).toBe(3); // birdie on par 3
    expect(calculateStablefordPoints(5, 5, 0)).toBe(2); // par on par 5
    expect(calculateStablefordPoints(3, 5, 0)).toBe(4); // eagle on par 5
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 1 WRAPPER: calculateNetStablefordTotal (handicap-aware full-round)
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 1 WRAPPER: calculateNetStablefordTotal', () => {
  it('1W.1: All-pars round = 36 (18 × 2)', () => {
    const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const scores = [...pars]; // every hole at par
    const total = calculateNetStablefordTotal(scores, pars);
    record('1W.1', '18 pars on par-72 course', '36', String(total), total === 36);
    expect(total).toBe(36);
  });

  it('1W.2: All-birdies round = 54 (18 × 3)', () => {
    const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const scores = pars.map((p) => p - 1); // every hole 1 under par
    const total = calculateNetStablefordTotal(scores, pars);
    record('1W.2', '18 birdies on par-72 course', '54', String(total), total === 54);
    expect(total).toBe(54);
  });

  it('1W.3: All-bogeys round = 18 (18 × 1)', () => {
    const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const scores = pars.map((p) => p + 1); // every hole 1 over par
    const total = calculateNetStablefordTotal(scores, pars);
    record('1W.3', '18 bogeys on par-72 course', '18', String(total), total === 18);
    expect(total).toBe(18);
  });

  it('1W.4: Mixed realistic round — FULL_18_SCORES → 33', () => {
    // Hand-computed per-hole: 2,1,2,1,2,2,0,3,3,1,2,3,2,1,2,2,2,2 = 33
    // (H7 score 5 vs par 3 = double bogey → 0; H8 birdie 3; H9 birdie 4-on-5; H12 birdie 2-on-3)
    const total = calculateNetStablefordTotal(FULL_18_SCORES, FULL_18_PARS);
    record('1W.4', 'FULL_18_SCORES on FULL_18_PARS, no handicap', '33', String(total), total === 33);
    expect(total).toBe(33);
  });

  it('1W.5: Handicap-aware — 18 bogeys + 9 strokes on first 9 holes = 27', () => {
    // Front 9 net pars (4-1=3 net, par 4): 2 pts each → 18
    // Back 9 raw bogeys (5 net, par 4): 1 pt each → 9
    // Total: 18 + 9 = 27 (vs gross 18)
    const pars = Array(18).fill(4);
    const scores = Array(18).fill(5); // every hole bogey gross
    const hcpStrokes = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const total = calculateNetStablefordTotal(scores, pars, hcpStrokes);
    record('1W.5', '18 bogeys + 9 hcp strokes on front 9', '27', String(total), total === 27);
    expect(total).toBe(27);
  });

  it('1W.6: Gross vs net diverge correctly — same scores, no/with handicap', () => {
    const pars = [4, 4, 4, 4, 4, 4, 4, 4, 4];
    const scores = [5, 5, 5, 5, 5, 5, 5, 5, 5]; // all bogeys
    const gross = calculateNetStablefordTotal(scores, pars);
    const net = calculateNetStablefordTotal(scores, pars, [1, 1, 1, 1, 1, 1, 1, 1, 1]);
    record('1W.6', 'Gross=9 (9 bogeys), Net=18 (9 net pars)', 'gross 9, net 18', `gross ${gross}, net ${net}`, gross === 9 && net === 18);
    expect(gross).toBe(9);
    expect(net).toBe(18);
  });

  it('1W.7: Double-bogey-or-worse caps at 0 (never negative)', () => {
    const pars = [4, 4, 4];
    const scores = [6, 8, 10]; // double, quad, sextuple bogey
    const total = calculateNetStablefordTotal(scores, pars);
    record('1W.7', '3 blow-up holes all cap at 0', '0', String(total), total === 0);
    expect(total).toBe(0);
  });

  it('1W.8: Partial round — front 9 only = 18 (9 pars)', () => {
    const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5];
    const scores = [...pars];
    const total = calculateNetStablefordTotal(scores, pars);
    record('1W.8', '9 pars front-9 only', '18', String(total), total === 18);
    expect(total).toBe(18);
  });

  it('1W.9: Albatross + eagle high-points — 1 on par 4 + 3 on par 5 + 1 on par 5 = 5+4+5 = 14', () => {
    const pars = [4, 5, 5];
    const scores = [1, 3, 1]; // albatross, eagle, albatross (4-under = 5)
    const total = calculateNetStablefordTotal(scores, pars);
    record('1W.9', 'albatross + eagle + 4-under albatross', '14', String(total), total === 14);
    expect(total).toBe(14);
  });

  it('1W.10: handicapStrokesPerHole undefined ≡ all-zeros array', () => {
    const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5];
    const scores = [4, 5, 3, 6, 4, 4, 5, 3, 4]; // mixed
    const noArr = calculateNetStablefordTotal(scores, pars);
    const zeros = calculateNetStablefordTotal(scores, pars, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
    record('1W.10', 'undefined hcp ≡ all-zeros hcp', `equal: ${noArr}`, `noArr ${noArr}, zeros ${zeros}`, noArr === zeros);
    expect(noArr).toBe(zeros);
  });

  it('1W.11: Two strokes on a single hole (high handicap) — score 6 par 4 + 2 strokes = net par', () => {
    const pars = [4];
    const scores = [6];
    const hcpStrokes = [2];
    const total = calculateNetStablefordTotal(scores, pars, hcpStrokes);
    record('1W.11', 'Score 6, par 4, 2 hcp strokes (net 4 = par)', '2', String(total), total === 2);
    expect(total).toBe(2);
  });

  it('1W.12: Length mismatch — uses min(scores, pars), extra entries ignored', () => {
    const pars = [4, 4, 4, 4, 4];
    const scores = [4, 4]; // only 2 hole scores
    const total = calculateNetStablefordTotal(scores, pars);
    record('1W.12', '2 scores vs 5 pars → uses 2 holes', '4', String(total), total === 4);
    expect(total).toBe(4); // 2 pars × 2 pts
  });

  it('1W.13: Empty round = 0', () => {
    const total = calculateNetStablefordTotal([], []);
    record('1W.13', 'empty round', '0', String(total), total === 0);
    expect(total).toBe(0);
  });

  it('1W.14: Cross-check — delegating to per-hole engine matches manual sum on FULL_18', () => {
    const manual = FULL_18_SCORES.reduce(
      (sum, score, i) => sum + calculateStablefordPoints(score, FULL_18_PARS[i], 0),
      0,
    );
    const wrapped = calculateNetStablefordTotal(FULL_18_SCORES, FULL_18_PARS);
    record('1W.14', 'manual per-hole sum ≡ wrapper', String(manual), String(wrapped), manual === wrapped);
    expect(manual).toBe(wrapped);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 2: MODIFIED STABLEFORD
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 2: MODIFIED STABLEFORD', () => {
  it('2.1: Eagle = +5', () => {
    const pts = calculateModifiedStablefordPoints(2, 4, 0);
    record('2.1', 'Score 2, Par 4 (eagle)', '+5', String(pts), pts === 5);
    expect(pts).toBe(5);
  });

  it('2.2: Birdie = +2', () => {
    const pts = calculateModifiedStablefordPoints(3, 4, 0);
    record('2.2', 'Score 3, Par 4 (birdie)', '+2', String(pts), pts === 2);
    expect(pts).toBe(2);
  });

  it('2.3: Par = 0', () => {
    const pts = calculateModifiedStablefordPoints(4, 4, 0);
    record('2.3', 'Score 4, Par 4 (par)', '0', String(pts), pts === 0);
    expect(pts).toBe(0);
  });

  it('2.4: Bogey = -1', () => {
    const pts = calculateModifiedStablefordPoints(5, 4, 0);
    record('2.4', 'Score 5, Par 4 (bogey)', '-1', String(pts), pts === -1);
    expect(pts).toBe(-1);
  });

  it('2.5: Double bogey = -3', () => {
    const pts = calculateModifiedStablefordPoints(6, 4, 0);
    record('2.5', 'Score 6, Par 4 (double bogey)', '-3', String(pts), pts === -3);
    expect(pts).toBe(-3);
  });

  it('2.6: Triple bogey = -5', () => {
    const pts = calculateModifiedStablefordPoints(7, 4, 0);
    record('2.6', 'Score 7, Par 4 (triple bogey)', '-5', String(pts), pts === -5);
    expect(pts).toBe(-5);
  });

  it('2.7: Albatross = +8', () => {
    const pts = calculateModifiedStablefordPoints(1, 4, 0);
    record('2.7', 'Score 1, Par 4 (albatross)', '+8', String(pts), pts === 8);
    expect(pts).toBe(8);
  });

  it('2.8: Negative total possible — bad front 9', () => {
    const scores = [6, 6, 6, 6, 6, 6, 6, 6, 6];
    const pars = [4, 4, 4, 4, 4, 4, 4, 4, 4];
    const total = calculateModifiedStablefordFromRound(scores, pars);
    record('2.8', '9 double bogeys on par 4s', '-27', String(total), total === -27);
    expect(total).toBe(-27);
  });

  it('2.9: Front 9 with mixed scores [4,5,3,6,4,4,5,3,4]', () => {
    const total = calculateModifiedStablefordFromRound(FRONT_9_SCORES, FRONT_9_PARS);
    const expected = 0 + (-1) + 2 + (-3) + 0 + 0 + (-1) + 2 + 0; // -1
    record('2.9', 'Scores [4,5,3,6,4,4,5,3,4] on par 4s', String(expected), String(total), total === expected);
    expect(total).toBe(expected);
  });

  it('2.10: Different scale from standard Stableford', () => {
    const std = calculateStablefordPoints(4, 4, 0);
    const mod = calculateModifiedStablefordPoints(4, 4, 0);
    expect(std).toBe(2); // Standard par = 2
    expect(mod).toBe(0); // Modified par = 0

    const stdBogey = calculateStablefordPoints(5, 4, 0);
    const modBogey = calculateModifiedStablefordPoints(5, 4, 0);
    expect(stdBogey).toBe(1);  // Standard bogey = 1
    expect(modBogey).toBe(-1); // Modified bogey = -1
  });

  it('2.11: Handicap strokes shift result', () => {
    const pts = calculateModifiedStablefordPoints(5, 4, 1);
    record('2.11', 'Score 5, Par 4, 1 HCP stroke (net par)', '0', String(pts), pts === 0);
    expect(pts).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 3: STROKE PLAY NET
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 3: STROKE PLAY NET', () => {
  it('3.1: Basic net score — Gross 82, Course Handicap 12 → Net 70', () => {
    const net = calculateNetScore(82, 12);
    record('3.1', 'Gross 82, Course HCP 12', '70', String(net), net === 70);
    expect(net).toBe(70);
  });

  it('3.2: Net score — Gross 72, Course Handicap 0 → Net 72 (scratch)', () => {
    const net = calculateNetScore(72, 0);
    record('3.2', 'Gross 72, Course HCP 0 (scratch)', '72', String(net), net === 72);
    expect(net).toBe(72);
  });

  it('3.3: Net score — Gross 95, Course Handicap 24 → Net 71', () => {
    const net = calculateNetScore(95, 24);
    record('3.3', 'Gross 95, Course HCP 24', '71', String(net), net === 71);
    expect(net).toBe(71);
  });

  it('3.4: Course Handicap — HCP Index 15, Slope 135, Rating 72.5, Par 72', () => {
    const chp = calculateCourseHandicap(15, 135, 72.5, 72);
    record('3.4', 'HCP 15, Slope 135, Rating 72.5, Par 72', '18', String(chp), chp === 18);
    expect(chp).toBe(18);
  });

  it('3.5: Course Handicap — HCP Index 5.2, Slope 113, Rating 70.1, Par 72', () => {
    const chp = calculateCourseHandicap(5.2, 113, 70.1, 72);
    record('3.5', 'HCP 5.2, Slope 113, Rating 70.1, Par 72', '3', String(chp), chp === 3);
    expect(chp).toBe(3);
  });

  it('3.6: Full pipeline — HCP Index → Course HCP → Net Score', () => {
    const courseHcp = calculateCourseHandicap(12, 125, 71.0, 72);
    expect(courseHcp).toBe(12);
    const net = calculateNetScore(82, courseHcp);
    record('3.6', 'HCP 12, Slope 125, Rating 71, Gross 82', 'Course HCP 12 → Net 70', `Course HCP ${courseHcp} → Net ${net}`, net === 70);
    expect(net).toBe(70);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 4: STROKE PLAY GROSS
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 4: STROKE PLAY GROSS', () => {
  it('4.1: Gross score unchanged — 82 stays 82', () => {
    const gross = 82;
    record('4.1', 'Gross 82', '82', String(gross), gross === 82);
    expect(gross).toBe(82);
  });

  it('4.2: No handicap applied — gross ≠ net', () => {
    const gross = 82;
    const courseHcp = 12;
    record('4.2', 'Gross 82 (HCP 12 ignored)', '82 (not 70)', String(gross), gross === 82);
    expect(gross).toBe(82);
    const net = calculateNetScore(gross, courseHcp);
    expect(net).toBe(70);
    expect(gross).toBe(82);
  });

  it('4.3: Gross total from hole-by-hole scores', () => {
    const grossTotal = FRONT_9_SCORES.reduce((sum, s) => sum + s, 0);
    record('4.3', 'Sum of [4,5,3,6,4,4,5,3,4]', '38', String(grossTotal), grossTotal === 38);
    expect(grossTotal).toBe(38);
  });

  it('4.4: Gross to-par — 38 on par 36 = +2', () => {
    const gross = 38;
    const par = FRONT_9_PARS.reduce((sum, p) => sum + p, 0);
    const toPar = gross - par;
    record('4.4', 'Gross 38, Par 36 (front 9)', '+2', `+${toPar}`, toPar === 2);
    expect(toPar).toBe(2);
  });

  it('4.5: Full 18 gross total', () => {
    const grossTotal = FULL_18_SCORES.reduce((sum, s) => sum + s, 0);
    const parTotal = FULL_18_PARS.reduce((sum, p) => sum + p, 0);
    record('4.5', 'Full 18 gross', `Gross ${grossTotal}, Par ${parTotal}`, `Gross ${grossTotal}, Par ${parTotal}`, parTotal === 72 && grossTotal === 75);
    expect(parTotal).toBe(72);
    expect(grossTotal).toBe(75);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 5: QUOTA
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 5: QUOTA', () => {
  it('5.1: Quota target — handicap 15 → target = 36 - 15 = 21', () => {
    const target = quotaTarget(15);
    record('5.1', 'Handicap 15', 'Target = 21', `Target = ${target}`, target === 21);
    expect(target).toBe(21);
  });

  it('5.2: Quota result — 24 pts, handicap 15 → +3 over quota', () => {
    const result = quotaResult(24, 15);
    record('5.2', '24 Stableford pts, HCP 15 (target 21)', '+3', String(result), result === 3);
    expect(result).toBe(3);
  });

  it('5.3: Quota result — under quota', () => {
    const result = quotaResult(18, 15);
    record('5.3', '18 Stableford pts, HCP 15 (target 21)', '-3', String(result), result === -3);
    expect(result).toBe(-3);
  });

  it('5.4: Quota result — exactly on quota', () => {
    const result = quotaResult(21, 15);
    record('5.4', '21 Stableford pts, HCP 15 (target 21)', '0', String(result), result === 0);
    expect(result).toBe(0);
  });

  it('5.5: Quota target — scratch player (HCP 0) → target 36', () => {
    const target = quotaTarget(0);
    record('5.5', 'Handicap 0 (scratch)', 'Target = 36', `Target = ${target}`, target === 36);
    expect(target).toBe(36);
  });

  it('5.6: Quota target — high handicap (HCP 30) → target 6', () => {
    const target = quotaTarget(30);
    record('5.6', 'Handicap 30', 'Target = 6', `Target = ${target}`, target === 6);
    expect(target).toBe(6);
  });

  it('5.7: Full pipeline — calculate Stableford then quota result', () => {
    const stableford = calculateStablefordFromRound(FRONT_9_SCORES, FRONT_9_PARS);
    expect(stableford).toBe(16);
    const target18 = quotaTarget(12);
    const result18 = quotaResult(32, 12);
    record('5.7', '32 Stableford pts (18 holes), HCP 12', 'Target 24, Result +8', `Target ${target18}, Result ${result18}`, result18 === 8);
    expect(target18).toBe(24);
    expect(result18).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 6: BEST 9
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 6: BEST 9', () => {
  it('6.1: Select best 9 from 18 holes of Stableford points', () => {
    const holePoints = [2, 1, 3, 0, 2, 2, 1, 3, 2, 1, 2, 4, 2, 1, 2, 2, 2, 2];
    // Sorted desc: 4, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0
    // Best 9: 4 + 3 + 3 + 2 + 2 + 2 + 2 + 2 + 2 = 22
    const { total, selectedIndices } = calculateBestNHoles(holePoints, 9);
    record('6.1', '18 holes points, select best 9', '22', String(total), total === 22);
    expect(total).toBe(22);
    expect(selectedIndices.length).toBe(9);
  });

  it('6.2: Best 9 selects highest, not front/back 9', () => {
    const holePoints = [2, 1, 3, 0, 2, 2, 1, 3, 2, 1, 2, 4, 2, 1, 2, 2, 2, 2];
    const frontTotal = holePoints.slice(0, 9).reduce((a, b) => a + b, 0); // 16
    const backTotal = holePoints.slice(9).reduce((a, b) => a + b, 0); // 18
    const { total } = calculateBestNHoles(holePoints, 9);
    record('6.2', 'Best 9 vs front/back', `Best 9 (${total}) > front (${frontTotal}) and >= back (${backTotal})`, String(total), total > frontTotal && total >= backTotal);
    expect(total).toBeGreaterThan(frontTotal);
    expect(total).toBe(22);
  });

  it('6.3: Best 9 with all equal points', () => {
    const holePoints = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    const { total } = calculateBestNHoles(holePoints, 9);
    record('6.3', '18 holes all 2 pts', '18', String(total), total === 18);
    expect(total).toBe(18);
  });

  it('6.4: Best 9 indices include highest-scoring holes', () => {
    const holePoints = [0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0];
    const { total, selectedIndices } = calculateBestNHoles(holePoints, 9);
    // Top 3 non-zero: index 2(3), 7(3), 11(4)
    // Rest are 0s, 9 selected total → 4 + 3 + 3 + 0*6 = 10
    expect(total).toBe(10);
    expect(selectedIndices.indexOf(2) >= 0).toBeTruthy();
    expect(selectedIndices.indexOf(7) >= 0).toBeTruthy();
    expect(selectedIndices.indexOf(11) >= 0).toBeTruthy();
  });

  it('6.5: Best 6 variant works too', () => {
    const holePoints = [2, 1, 3, 0, 2, 2, 1, 3, 2, 1, 2, 4, 2, 1, 2, 2, 2, 2];
    // Best 6: 4 + 3 + 3 + 2 + 2 + 2 = 16
    const { total, selectedIndices } = calculateBestNHoles(holePoints, 6);
    record('6.5', '18 holes points, select best 6', '16', String(total), total === 16);
    expect(total).toBe(16);
    expect(selectedIndices.length).toBe(6);
  });

  it('6.6: Full pipeline — scores to Stableford to Best 9', () => {
    const perHolePoints: number[] = [];
    for (let i = 0; i < 18; i++) {
      perHolePoints.push(calculateStablefordPoints(FULL_18_SCORES[i], FULL_18_PARS[i], 0));
    }
    // Scores: [4,5,3,6,4,4,5,3,4,5,5,2,4,5,4,3,5,4]
    // Pars:   [4,4,3,5,4,4,3,4,5,4,5,3,4,4,4,3,5,4]
    // Diffs:  [0,1,0,1,0,0,2,-1,-1,1,0,-1,0,1,0,0,0,0]
    // Points: [2,1,2,1,2,2,0,3,3,1,2,3,2,1,2,2,2,2]
    const expectedPerHole = [2, 1, 2, 1, 2, 2, 0, 3, 3, 1, 2, 3, 2, 1, 2, 2, 2, 2];
    expect(perHolePoints).toEqual(expectedPerHole);

    const fullTotal = perHolePoints.reduce((a, b) => a + b, 0); // 33
    const { total: best9Total } = calculateBestNHoles(perHolePoints, 9);
    // Best 9: 3,3,3,2,2,2,2,2,2 = 21
    record('6.6', 'Full 18 → Stableford → Best 9', `Full: 33, Best 9: 21`, `Full: ${fullTotal}, Best 9: ${best9Total}`, best9Total === 21);
    expect(fullTotal).toBe(33);
    expect(best9Total).toBe(21);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 7: MATCH PLAY (calculateMatchPlay — bare gross engine)
// ═══════════════════════════════════════════════════════════════════════
// NOTE: The engine's 'AS' result branch (line ~747 of scoring.ts) is an
// intentionally-unreachable defensive case — early close-out only fires
// when lead > holesRemaining, which cannot occur with a tied score, so
// matchEndedAtHole < totalHoles && finalDiff === 0 is mathematically
// impossible. 'HALVED' (full 18 played, tied) is reachable; 'AS' is not.
// Not a missing test case.

describe('FORMAT 7: MATCH PLAY', () => {
  it('7.1: All 18 halved → HALVED, winner null, no early close', () => {
    const a = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const r = calculateMatchPlay(a, b);
    record('7.1', '18 halved holes', 'HALVED winner=null at hole 18', `${r.result} winner=${r.winner} at ${r.matchEndedAtHole}`, r.result === 'HALVED' && r.winner === null && r.matchEndedAtHole === 18);
    expect(r.result).toBe('HALVED');
    expect(r.winner).toBe(null);
    expect(r.matchEndedAtHole).toBe(18);
    expect(r.holesHalved).toBe(18);
  });

  it('7.2: A wins 2 UP on final hole (halve 1–16, A wins 17 & 18)', () => {
    // After hole 17: lead 1, remaining 1 → 1>1 false → continue
    // After hole 18: lead 2, remaining 0 → 2>0 → close at 18
    const a = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const r = calculateMatchPlay(a, b);
    record('7.2', 'A wins 2 UP on hole 18', '"2 UP" winner=A at hole 18', `${r.result} winner=${r.winner} at ${r.matchEndedAtHole}`, r.result === '2 UP' && r.winner === 'A' && r.matchEndedAtHole === 18);
    expect(r.result).toBe('2 UP');
    expect(r.winner).toBe('A');
    expect(r.matchEndedAtHole).toBe(18);
  });

  it('7.3: Early close 3&2 (A wins 1–3, halve 4–16, closes at hole 16)', () => {
    // After hole 16: lead 3, remaining 2 → 3>2 → close at 16
    const a = [3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const r = calculateMatchPlay(a, b);
    record('7.3', 'A wins 3 holes, halves to 16', '"3&2" winner=A at hole 16', `${r.result} winner=${r.winner} at ${r.matchEndedAtHole}`, r.result === '3&2' && r.winner === 'A' && r.matchEndedAtHole === 16);
    expect(r.result).toBe('3&2');
    expect(r.winner).toBe('A');
    expect(r.matchEndedAtHole).toBe(16);
  });

  it('7.4: Dormie case — 2 UP with 2 to play continues, closes 2&1 at hole 17', () => {
    // Halve 1–14, A wins 15 & 16, halve 17.
    // After hole 16: lead 2, remaining 2 → 2>2 false → continue (Dormie preserved)
    // After hole 17: lead 2, remaining 1 → 2>1 → close at hole 17
    const a = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const r = calculateMatchPlay(a, b);
    record('7.4', 'Dormie at 16 → closes 2&1 at 17', '"2&1" at hole 17 (NOT 16)', `${r.result} at ${r.matchEndedAtHole}`, r.result === '2&1' && r.matchEndedAtHole === 17);
    expect(r.matchEndedAtHole).toBeGreaterThan(16); // Did not close early at Dormie
    expect(r.result).toBe('2&1');
    expect(r.matchEndedAtHole).toBe(17);
    expect(r.winner).toBe('A');
  });

  it('7.5: Big margin 6&5 — A sweeps first 6, halves to hole 13', () => {
    // After hole 13: lead 6, remaining 5 → 6>5 → close at 13
    const a = [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const r = calculateMatchPlay(a, b);
    record('7.5', 'A sweeps 1–6, halves 7–13', '"6&5" winner=A at hole 13', `${r.result} winner=${r.winner} at ${r.matchEndedAtHole}`, r.result === '6&5' && r.winner === 'A' && r.matchEndedAtHole === 13);
    expect(r.result).toBe('6&5');
    expect(r.winner).toBe('A');
    expect(r.matchEndedAtHole).toBe(13);
    expect(r.holesWonA).toBe(6);
    expect(r.holesHalved).toBe(7);
  });

  it('7.6: Single-hole match — A wins → "1 UP" at hole 1', () => {
    const r = calculateMatchPlay([3], [4]);
    record('7.6', '1-hole match, A wins', '"1 UP" winner=A at hole 1', `${r.result} winner=${r.winner} at ${r.matchEndedAtHole}`, r.result === '1 UP' && r.winner === 'A' && r.matchEndedAtHole === 1);
    expect(r.result).toBe('1 UP');
    expect(r.winner).toBe('A');
    expect(r.matchEndedAtHole).toBe(1);
  });

  it('7.7: holeResults array tags per-hole winners correctly', () => {
    // A wins hole 1, B wins hole 2, halve hole 3 → final HALVED (1-1 tied)
    const r = calculateMatchPlay([3, 4, 4], [4, 3, 4]);
    record('7.7', 'A wins 1, B wins 2, halve 3', "['A','B','halved']", JSON.stringify(r.holeResults), r.holeResults.length === 3 && r.holeResults[0] === 'A' && r.holeResults[1] === 'B' && r.holeResults[2] === 'halved');
    expect(r.holeResults).toEqual(['A', 'B', 'halved']);
    expect(r.result).toBe('HALVED');
  });

  it('7.8: Mismatched array lengths — uses min(A, B)', () => {
    // A has 18 scores, B has 9 → totalHoles=9, all halved → HALVED at hole 9
    const a = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4];
    const r = calculateMatchPlay(a, b);
    record('7.8', 'A len 18, B len 9', 'HALVED at hole 9 (uses min)', `${r.result} at ${r.matchEndedAtHole}`, r.result === 'HALVED' && r.matchEndedAtHole === 9);
    expect(r.matchEndedAtHole).toBe(9);
    expect(r.result).toBe('HALVED');
    expect(r.holesHalved).toBe(9);
  });

  it('7.9: B as winner — B sweeps, closes 10&8 at hole 10', () => {
    // After hole 10: B=10, A=0, lead 10, remaining 8 → 10>8 → close at 10
    const a = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
    const r = calculateMatchPlay(a, b);
    record('7.9', 'B sweeps 10 holes', '"10&8" winner=B at hole 10', `${r.result} winner=${r.winner} at ${r.matchEndedAtHole}`, r.result === '10&8' && r.winner === 'B' && r.matchEndedAtHole === 10);
    expect(r.result).toBe('10&8');
    expect(r.winner).toBe('B');
    expect(r.matchEndedAtHole).toBe(10);
  });

  it('7.10: 9-hole partial round all halved → HALVED at hole 9', () => {
    const a = [4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4];
    const r = calculateMatchPlay(a, b);
    record('7.10', '9-hole halved match', 'HALVED at hole 9', `${r.result} at ${r.matchEndedAtHole}`, r.result === 'HALVED' && r.matchEndedAtHole === 9);
    expect(r.result).toBe('HALVED');
    expect(r.matchEndedAtHole).toBe(9);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 7 WRAPPER: calculateNetMatchPlay (handicap-aware net match)
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 7 WRAPPER: calculateNetMatchPlay', () => {
  it('7W.1: No handicap arrays → identical to bare calculateMatchPlay', () => {
    const a = [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const bare = calculateMatchPlay(a, b);
    const wrapped = calculateNetMatchPlay(a, b);
    record('7W.1', 'wrapper(A,B) ≡ engine(A,B)', `deep-equal: ${bare.result}`, `bare ${bare.result}, wrapped ${wrapped.result}`, JSON.stringify(bare) === JSON.stringify(wrapped));
    expect(wrapped).toEqual(bare);
  });

  it("7W.2: B's per-hole strokes flip A's sweep to all-halved", () => {
    // Gross: A birdies every hole, B pars every hole — A would sweep
    const a = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const hcpB = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const r = calculateNetMatchPlay(a, b, undefined, hcpB);
    record('7W.2', "A birdies vs B pars + 1 hcp/hole to B", 'HALVED', `${r.result} winner=${r.winner}`, r.result === 'HALVED' && r.winner === null);
    expect(r.result).toBe('HALVED');
    expect(r.winner).toBe(null);
    expect(r.holesHalved).toBe(18);
  });

  it('7W.3: Asymmetric — A with strokes, B undefined → B defaults to 0', () => {
    // Gross: A bogeys (5), B pars (4) — A would lose every hole
    // With 1 stroke per hole to A: A net = 4 (= B's 4) → all halved
    const a = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const b = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const hcpA = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const r = calculateNetMatchPlay(a, b, hcpA);
    record('7W.3', 'A bogeys + 1 hcp/hole, B undefined ≡ 0', 'HALVED', `${r.result} winner=${r.winner}`, r.result === 'HALVED' && r.winner === null);
    expect(r.result).toBe('HALVED');
    expect(r.winner).toBe(null);
  });

  it('7W.4: All-zeros stroke arrays ≡ undefined stroke arrays', () => {
    const a = [4, 5, 4, 5, 4, 4, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [5, 4, 4, 4, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const zeros = Array(18).fill(0);
    const undef = calculateNetMatchPlay(a, b);
    const allZeros = calculateNetMatchPlay(a, b, zeros, zeros);
    record('7W.4', 'undefined ≡ all-zeros parity', `equal: ${undef.result}`, `undef ${undef.result}, zeros ${allZeros.result}`, JSON.stringify(undef) === JSON.stringify(allZeros));
    expect(allZeros).toEqual(undef);
  });

  it('7W.5: Strokes flip winner AND preserve close-out vocab — gross "6&5" B becomes net "7&5" A', () => {
    // Gross: B sweeps holes 1–6 by 1 stroke, halves rest
    //   → After hole 13: B=6, halved=6, lead=6, remaining=5 → close, "6&5" B wins
    const a = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const b = [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const grossResult = calculateMatchPlay(a, b);
    expect(grossResult.result).toBe('6&5');
    expect(grossResult.winner).toBe('B');
    expect(grossResult.matchEndedAtHole).toBe(13);

    // Now give A 1 stroke every hole. A net = 3.
    // Holes 1–6: 3 vs 3 → halved. Holes 7–13: 3 vs 4 → A wins 7.
    //   → After hole 13: A=7, halved=6, lead=7, remaining=5 → close, "7&5" A wins
    const hcpA = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const netResult = calculateNetMatchPlay(a, b, hcpA);
    record('7W.5', 'gross B 6&5 → net A 7&5 after strokes', '"7&5" winner=A at 13', `${netResult.result} winner=${netResult.winner} at ${netResult.matchEndedAtHole}`, netResult.result === '7&5' && netResult.winner === 'A' && netResult.matchEndedAtHole === 13);
    expect(netResult.result).toBe('7&5');
    expect(netResult.winner).toBe('A');
    expect(netResult.matchEndedAtHole).toBe(13);
    expect(netResult.holesWonA).toBe(7);
    expect(netResult.holesHalved).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 8: BEST BALL (calculateBestBall — bare gross engine)
// ═══════════════════════════════════════════════════════════════════════
// Engine also serves Four-Ball (per SCORING_FORMATS description); the
// match-play composition for fourball is a display-layer concern handled
// by feeding teamScorePerHole into calculateNetMatchPlay, not a new engine.

describe('FORMAT 8: BEST BALL', () => {
  it('8.1: Single player → team total equals player total (degenerate)', () => {
    const scores = [4, 5, 4, 5, 4, 5, 4, 5, 4]; // 40
    const r = calculateBestBall([scores]);
    record('8.1', '1 player, 9 holes', 'teamTotal=40, perHole=scores', `total=${r.teamTotal}`, r.teamTotal === 40 && JSON.stringify(r.teamScorePerHole) === JSON.stringify(scores));
    expect(r.teamTotal).toBe(40);
    expect(r.teamScorePerHole).toEqual(scores);
  });

  it('8.2: 2 players, mixed best-per-hole', () => {
    // Per-hole min: hole 0 min(4,5)=4, hole 1 min(5,4)=4, hole 2 min(4,4)=4, hole 3 min(5,4)=4, hole 4 min(4,5)=4
    const p1 = [4, 5, 4, 5, 4];
    const p2 = [5, 4, 4, 4, 5];
    const r = calculateBestBall([p1, p2]);
    const expectedPerHole = [4, 4, 4, 4, 4];
    record('8.2', '2 players mixed best', '[4,4,4,4,4] total 20', `${JSON.stringify(r.teamScorePerHole)} total ${r.teamTotal}`, r.teamTotal === 20 && JSON.stringify(r.teamScorePerHole) === JSON.stringify(expectedPerHole));
    expect(r.teamScorePerHole).toEqual(expectedPerHole);
    expect(r.teamTotal).toBe(20);
  });

  it('8.3: 4 players, rotating winner per hole', () => {
    // Each player wins exactly one hole; all others post higher
    const p1 = [4, 5, 5, 5];
    const p2 = [5, 4, 5, 5];
    const p3 = [5, 5, 4, 5];
    const p4 = [5, 5, 5, 4];
    const r = calculateBestBall([p1, p2, p3, p4]);
    // Per-hole min: 4, 4, 4, 4
    record('8.3', '4 players, each wins 1 hole', '[4,4,4,4] total 16', `${JSON.stringify(r.teamScorePerHole)} total ${r.teamTotal}`, r.teamTotal === 16);
    expect(r.teamScorePerHole).toEqual([4, 4, 4, 4]);
    expect(r.teamTotal).toBe(16);
  });

  it('8.4: Empty playerScores → { teamScorePerHole: [], teamTotal: 0 }', () => {
    const r = calculateBestBall([]);
    record('8.4', 'empty array', '{ [], 0 }', `${JSON.stringify(r.teamScorePerHole)} total ${r.teamTotal}`, r.teamScorePerHole.length === 0 && r.teamTotal === 0);
    expect(r.teamScorePerHole).toEqual([]);
    expect(r.teamTotal).toBe(0);
  });

  it('8.5: Uneven array lengths — partial scorecards handled', () => {
    // numHoles = playerScores[0].length = 5
    // P2 has only 3 scores. For holes 3 and 4, only P1 contributes.
    const p1 = [4, 5, 4, 5, 4]; // full 5 holes
    const p2 = [5, 4, 4];        // partial — 3 holes
    const r = calculateBestBall([p1, p2]);
    // Hole 0: min(4,5)=4; Hole 1: min(5,4)=4; Hole 2: min(4,4)=4
    // Hole 3: only P1 (P2 out of bounds) → 5; Hole 4: only P1 → 4
    record('8.5', 'P1 5 holes, P2 3 holes', '[4,4,4,5,4] total 21', `${JSON.stringify(r.teamScorePerHole)} total ${r.teamTotal}`, r.teamTotal === 21);
    expect(r.teamScorePerHole).toEqual([4, 4, 4, 5, 4]);
    expect(r.teamTotal).toBe(21);
  });

  it('8.6: All players identical → team total equals each player total', () => {
    const same = [4, 5, 4, 5, 4]; // 22
    const r = calculateBestBall([same, same, same]);
    record('8.6', '3 identical players', 'teamTotal=22 (not 66)', `total=${r.teamTotal}`, r.teamTotal === 22);
    expect(r.teamScorePerHole).toEqual(same);
    expect(r.teamTotal).toBe(22);
  });

  it('8.7: Tie behavior — no double-count when two players post same score', () => {
    // Both players post 4 on every hole. Team should post 4 per hole, not 8.
    const p1 = [4, 4, 4];
    const p2 = [4, 4, 4];
    const r = calculateBestBall([p1, p2]);
    record('8.7', '2 identical players, no double-count', 'teamTotal=12 (not 24)', `total=${r.teamTotal}`, r.teamTotal === 12);
    expect(r.teamScorePerHole).toEqual([4, 4, 4]);
    expect(r.teamTotal).toBe(12);
  });

  it('8.8: NaN fallback — if no player has a valid score for a hole, posts 0', () => {
    // NaN < Infinity is false (all NaN comparisons return false), so best stays Infinity
    // → engine's defensive fallback at scoring.ts:817 pushes 0
    const r = calculateBestBall([[NaN, NaN, NaN]]);
    record('8.8', 'single player, all NaN', '[0,0,0] total 0', `${JSON.stringify(r.teamScorePerHole)} total ${r.teamTotal}`, r.teamTotal === 0 && r.teamScorePerHole.every((s) => s === 0));
    expect(r.teamScorePerHole).toEqual([0, 0, 0]);
    expect(r.teamTotal).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 8 WRAPPER: calculateNetBestBall (handicap-aware net best ball)
// ═══════════════════════════════════════════════════════════════════════

describe('FORMAT 8 WRAPPER: calculateNetBestBall', () => {
  it('8W.1: No handicap arrays → identical to bare calculateBestBall', () => {
    const p1 = [4, 5, 5, 5];
    const p2 = [5, 4, 5, 5];
    const p3 = [5, 5, 4, 5];
    const p4 = [5, 5, 5, 4];
    const bare = calculateBestBall([p1, p2, p3, p4]);
    const wrapped = calculateNetBestBall([p1, p2, p3, p4]);
    record('8W.1', 'wrapper(scores) ≡ engine(scores)', `deep-equal total=${bare.teamTotal}`, `bare ${bare.teamTotal}, wrapped ${wrapped.teamTotal}`, JSON.stringify(bare) === JSON.stringify(wrapped));
    expect(wrapped).toEqual(bare);
  });

  it('8W.2: STROKE FLIPS THE BEST-BALL PICK — correctness crux', () => {
    // 2 players, 3 holes
    // P1 (low hcp, no strokes):  gross [4, 5, 5]
    // P2 (high hcp, 2 strokes):  gross [5, 5, 6], strokes [0, 1, 2] → net [5, 4, 4]
    //
    // GROSS best per hole:
    //   Hole 0: min(4, 5) = 4 (P1)
    //   Hole 1: min(5, 5) = 5 (tie, P1 wins via strict <)
    //   Hole 2: min(5, 6) = 5 (P1)
    //   Gross teamTotal = 4 + 5 + 5 = 14
    //
    // NET best per hole (strokes subtracted FIRST, then best-pick):
    //   Hole 0: min(4, 5) = 4 (P1 still — no stroke on hole 0)
    //   Hole 1: min(5, 4) = 4 (P2 FLIPS — stroke on hole 1 made net 4 beat P1's 5)
    //   Hole 2: min(5, 4) = 4 (P2 FLIPS — 2 strokes made net 4 beat P1's 5)
    //   Net teamTotal = 4 + 4 + 4 = 12
    //
    // The 2-stroke delta in teamTotal (14 → 12) proves the wrapper applies strokes
    // BEFORE the best-pick. Gross-first-then-subtract would have lost P2's contribution.
    const p1 = [4, 5, 5];
    const p2 = [5, 5, 6];
    const hcpP2 = [0, 1, 2];

    const gross = calculateBestBall([p1, p2]);
    expect(gross.teamScorePerHole).toEqual([4, 5, 5]);
    expect(gross.teamTotal).toBe(14);

    const net = calculateNetBestBall([p1, p2], [[0, 0, 0], hcpP2]);
    record('8W.2', 'gross [4,5,5]=14 → net [4,4,4]=12 (P2 strokes flip holes 1+2)', '[4,4,4] total 12', `${JSON.stringify(net.teamScorePerHole)} total ${net.teamTotal}`, net.teamTotal === 12 && JSON.stringify(net.teamScorePerHole) === '[4,4,4]');
    expect(net.teamScorePerHole).toEqual([4, 4, 4]);
    expect(net.teamTotal).toBe(12);
  });

  it('8W.3: All-zeros stroke arrays ≡ undefined stroke arrays', () => {
    const p1 = [4, 5, 4, 5, 4];
    const p2 = [5, 4, 4, 4, 5];
    const zeros = [0, 0, 0, 0, 0];
    const undef = calculateNetBestBall([p1, p2]);
    const allZeros = calculateNetBestBall([p1, p2], [zeros, zeros]);
    record('8W.3', 'undefined ≡ all-zeros parity', `equal total=${undef.teamTotal}`, `undef ${undef.teamTotal}, zeros ${allZeros.teamTotal}`, JSON.stringify(undef) === JSON.stringify(allZeros));
    expect(allZeros).toEqual(undef);
  });

  it('8W.4: Asymmetric — only P1 has strokes; P0 and P2 default to 0 (empty inner arrays)', () => {
    // 3 players. Only middle player carries handicap strokes.
    // P0: [5,5,5], no strokes (empty inner array) → net [5,5,5]
    // P1: [5,5,5], strokes [1,1,1]                → net [4,4,4]
    // P2: [5,5,5], no strokes (empty inner array) → net [5,5,5]
    // Best per hole: min(5,4,5) = 4 each → teamTotal 12
    const p0 = [5, 5, 5];
    const p1 = [5, 5, 5];
    const p2 = [5, 5, 5];
    const r = calculateNetBestBall([p0, p1, p2], [[], [1, 1, 1], []]);
    record('8W.4', 'asymmetric — only P1 strokes', '[4,4,4] total 12', `${JSON.stringify(r.teamScorePerHole)} total ${r.teamTotal}`, r.teamTotal === 12);
    expect(r.teamScorePerHole).toEqual([4, 4, 4]);
    expect(r.teamTotal).toBe(12);
  });

  it('8W.5: Mixed handicaps — each player\'s strokes applied independently before best-pick', () => {
    // 4 players, each gets exactly 1 stroke on a different hole.
    // All gross [5,5,5,5]. Each player nets [4,5,5,5] (rotating) for one hole.
    // P0: net [4,5,5,5]  P1: net [5,4,5,5]  P2: net [5,5,4,5]  P3: net [5,5,5,4]
    // Best per hole: hole 0→P0=4, hole 1→P1=4, hole 2→P2=4, hole 3→P3=4
    // Net teamTotal = 16. Gross would have been 5+5+5+5 = 20.
    const allGross = [5, 5, 5, 5];
    const players = [allGross, allGross, allGross, allGross];
    const hcps = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    const gross = calculateBestBall(players);
    expect(gross.teamTotal).toBe(20); // all 5s, no strokes

    const net = calculateNetBestBall(players, hcps);
    record('8W.5', '4 players, 1 stroke each on diff hole', '[4,4,4,4] total 16', `${JSON.stringify(net.teamScorePerHole)} total ${net.teamTotal}`, net.teamTotal === 16);
    expect(net.teamScorePerHole).toEqual([4, 4, 4, 4]);
    expect(net.teamTotal).toBe(16);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 9: SCRAMBLE — calculateScrambleTeamScore (engine sum)
// ═══════════════════════════════════════════════════════════════════════
// NOTE: No "FORMAT 9 WRAPPER" block exists — the handicap-conversion
// template breaks here. In a scramble the team plays one ball, posts one
// score per hole; there's no per-player score to subtract per-hole strokes
// from. Scramble handicap is a team-level scalar via a size-dependent
// fractional formula (e.g., 35/15 for 2-player teams, 20/15/10/5 for
// 4-player) and requires a NEW engine, not a wrapper around this trivial
// sum. Composted as a separate workstream blocked on formula decision.

describe('FORMAT 9: SCRAMBLE (calculateScrambleTeamScore)', () => {
  it('9.1: Sums 18-hole team scores', () => {
    // Front 9 [4,5,3,4,5,4,3,4,5] = 37; Back 9 [4,5,3,4,5,4,3,5,4] = 37; total 74
    const teamScores = [4, 5, 3, 4, 5, 4, 3, 4, 5, 4, 5, 3, 4, 5, 4, 3, 5, 4];
    const r = calculateScrambleTeamScore(teamScores);
    record('9.1', '18-hole scramble', 'teamTotal=74', `teamTotal=${r.teamTotal}`, r.teamTotal === 74);
    expect(r.teamTotal).toBe(74);
  });

  it('9.2: Empty array → { teamTotal: 0 }', () => {
    const r = calculateScrambleTeamScore([]);
    record('9.2', 'empty teamScoresPerHole', 'teamTotal=0', `teamTotal=${r.teamTotal}`, r.teamTotal === 0);
    expect(r.teamTotal).toBe(0);
  });

  it('9.3: Partial round (9 holes) sums correctly', () => {
    // [4,5,3,4,5,4,3,4,5] = 37
    const r = calculateScrambleTeamScore([4, 5, 3, 4, 5, 4, 3, 4, 5]);
    record('9.3', 'front-9 scramble', 'teamTotal=37', `teamTotal=${r.teamTotal}`, r.teamTotal === 37);
    expect(r.teamTotal).toBe(37);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 9 VALIDATOR: validateScrambleScore (data-integrity check)
// ═══════════════════════════════════════════════════════════════════════
// Real orphan logic, untested until now. Enforces the scramble physical
// constraint: the team always has the option to use any individual's ball,
// so the team's hole score can never be WORSE than the lowest individual's
// score on that hole. Team scores BELOW best individual are valid (real
// scramble case — combining best shots from multiple players can beat any
// single player's score).

describe('FORMAT 9 VALIDATOR: validateScrambleScore', () => {
  it('9V.1: Valid — team score equals best individual on every hole', () => {
    const team = [4, 5, 4];
    const individuals = [
      [4, 5, 4],
      [5, 6, 5],
    ];
    // bestIndividual per hole: min(4,5)=4, min(5,6)=5, min(4,5)=4 — team matches each
    const r = validateScrambleScore(team, individuals);
    record('9V.1', 'team = best individual', 'valid, no violations', `valid=${r.valid} violations=${JSON.stringify(r.violations)}`, r.valid === true && r.violations.length === 0);
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('9V.2: Valid — team BELOW best individual (real scramble case)', () => {
    // Team combines best shots from multiple players → posts lower than
    // any single individual's score. Validator must allow this.
    const team = [3, 3, 3];
    const individuals = [
      [4, 5, 4],
      [5, 4, 5],
    ];
    // bestIndividual per hole: [4, 4, 4]; team [3,3,3] is below each — all valid
    const r = validateScrambleScore(team, individuals);
    record('9V.2', 'team below best individual (combined best shots)', 'valid, no violations', `valid=${r.valid} violations=${JSON.stringify(r.violations)}`, r.valid === true && r.violations.length === 0);
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('9V.3: Invalid — team above best individual on one hole → single violation', () => {
    const team = [4, 6, 4];
    const individuals = [
      [4, 5, 4],
      [5, 5, 5],
    ];
    // bestIndividual per hole: [4, 5, 4]. Hole 1: team 6 > best 5 → violation at index 1
    const r = validateScrambleScore(team, individuals);
    record('9V.3', 'team 6 vs best 5 at hole 1', 'valid=false violations=[1]', `valid=${r.valid} violations=${JSON.stringify(r.violations)}`, r.valid === false && JSON.stringify(r.violations) === '[1]');
    expect(r.valid).toBe(false);
    expect(r.violations).toEqual([1]);
  });

  it('9V.4: Multiple non-contiguous violations', () => {
    const team = [6, 4, 6, 4, 6];
    const individuals = [
      [4, 4, 4, 4, 4],
      [5, 5, 5, 5, 5],
    ];
    // bestIndividual = [4,4,4,4,4]. Team > best at holes 0, 2, 4
    const r = validateScrambleScore(team, individuals);
    record('9V.4', '3 non-contiguous violations', 'violations=[0,2,4]', `${JSON.stringify(r.violations)}`, JSON.stringify(r.violations) === '[0,2,4]');
    expect(r.valid).toBe(false);
    expect(r.violations).toEqual([0, 2, 4]);
  });

  it('9V.5: Empty individualScoresPerHole → no constraint, all holes valid', () => {
    // No individuals to compare against → bestIndividual stays Infinity
    // → defensive guard at scoring.ts:886 skips violation check
    const team = [4, 5, 4];
    const r = validateScrambleScore(team, []);
    record('9V.5', 'no individual scores', 'valid, no violations', `valid=${r.valid} violations=${JSON.stringify(r.violations)}`, r.valid === true && r.violations.length === 0);
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('9V.6: Mismatched lengths — bestIndividual < Infinity guard skips unconstrained holes', () => {
    // Team has 12 holes recorded; individuals only have 9.
    // For holes 9–11, no individual contributes → bestIndividual stays Infinity
    // → the guard skips the violation check, even though team scored 99.
    const team = [4, 5, 4, 5, 4, 5, 4, 5, 4, 99, 99, 99];
    const individuals = [[4, 5, 4, 5, 4, 5, 4, 5, 4]];
    // Holes 0–8: team matches bestIndividual exactly → no violations
    // Holes 9–11: individual out of bounds → bestIndividual=Infinity → guard skips
    const r = validateScrambleScore(team, individuals);
    record('9V.6', 'team len 12, individuals len 9', 'valid, no violations (guard skips holes 9-11)', `valid=${r.valid} violations=${JSON.stringify(r.violations)}`, r.valid === true && r.violations.length === 0);
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('9V.7: Empty team scores → empty violations array, valid', () => {
    // Outer loop iterates 0 times → no violations possible
    const r = validateScrambleScore([], [[4, 5, 4]]);
    record('9V.7', 'empty team scores', 'valid, no violations', `valid=${r.valid} violations=${JSON.stringify(r.violations)}`, r.valid === true && r.violations.length === 0);
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 10: CHAPMAN / PINEHURST (calculateChapmanHoleScore + calculateChapmanTotal)
// ═══════════════════════════════════════════════════════════════════════
// NOTE: No "FORMAT 10 WRAPPER" block exists — like Scramble (FORMAT 9),
// Chapman uses a one-ball team-scoring model where the team plays a single
// ball from shot 3 onward. The engine takes one team-level integer per hole
// (alternateShots) plus a +2 constant for the drive + second shot. There is
// no per-player score to apply per-hole strokes to. Chapman handicap is a
// team-level scalar (USGA standard: 60% of low partner + 40% of high)
// requiring a NEW engine, not a wrapper. Composted as a separate workstream
// alongside the dead-data finding (5 of 6 ChapmanHoleScore fields are
// captured but unused in scoring) and the Pinehurst-variant question
// (engine currently doesn't differentiate when ball is selected).
// Pinehurst free-rides on this same engine.

describe('FORMAT 10: CHAPMAN (calculateChapmanHoleScore)', () => {
  it('10.1: Canonical case — drive + second + 3 alternate shots = score 5', () => {
    const hole: ChapmanHoleScore = {
      driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1,
      selectedBall: 'A', alternateShots: 3,
    };
    const score = calculateChapmanHoleScore(hole);
    // 2 (drive + partner's second shot) + 3 (alternate shots) = 5
    record('10.1', 'alternateShots=3', '5', String(score), score === 5);
    expect(score).toBe(5);
  });

  it('10.2: Degenerate edge — ball holed after second shot (alternateShots=0) → score 2', () => {
    // Drivable par 3 + chip-in scenario: team holes out on shot 2
    const hole: ChapmanHoleScore = {
      driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1,
      selectedBall: 'B', alternateShots: 0,
    };
    const score = calculateChapmanHoleScore(hole);
    record('10.2', 'alternateShots=0 (holed in 2)', '2', String(score), score === 2);
    expect(score).toBe(2);
  });

  it('10.3: DEAD-DATA LOCK — nonsense in 5 unused fields; score depends ONLY on alternateShots', () => {
    // The engine math is `2 + alternateShots`. The driveA/driveB/secondShotA/
    // secondShotB/selectedBall fields are captured by the struct but UNUSED
    // by the score computation. This test locks that contract: pass garbage
    // values into those fields and the result must equal `2 + alternateShots`
    // exactly. Tripwire for a future dev who adds reliance on those fields —
    // they'll hit this failure and find the Chapman compost entry explaining
    // the open design questions (drop / keep-for-stats / repurpose).
    const hole: ChapmanHoleScore = {
      driveA: 999,
      driveB: -42,
      secondShotA: NaN,
      secondShotB: 0,
      selectedBall: 'A',
      alternateShots: 4,
    };
    const score = calculateChapmanHoleScore(hole);
    // Expected: 2 + 4 = 6, NOT NaN, NOT affected by any of the 5 garbage fields
    record('10.3', 'garbage in dead fields, alternateShots=4', '6 (deterministic, not NaN)', String(score), score === 6);
    expect(score).toBe(6);
  });
});

describe('FORMAT 10 TOTAL: calculateChapmanTotal (full-round wrapper)', () => {
  it('10.4: 18-hole sum with varied alternateShots', () => {
    // alternateShots per hole: [3,4,1,5,3,3,4,3,4,3,5,1,3,3,3,2,5,3] sum=58
    // perHoleScores: each is (2 + alt): [5,6,3,7,5,5,6,5,6,5,7,3,5,5,5,4,7,5]
    // total = 36 (18 × +2) + 58 (sum of alt) = 94
    const altShots = [3, 4, 1, 5, 3, 3, 4, 3, 4, 3, 5, 1, 3, 3, 3, 2, 5, 3];
    const holes: ChapmanHoleScore[] = altShots.map((alt) => ({
      driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1,
      selectedBall: 'A', alternateShots: alt,
    }));
    const r = calculateChapmanTotal(holes);
    const expectedPerHole = altShots.map((alt) => 2 + alt);
    record('10.4', '18-hole Chapman, sum altShots=58', 'total 94, perHole [5,6,3,7,5,...,5]', `total ${r.total}`, r.total === 94 && JSON.stringify(r.perHoleScores) === JSON.stringify(expectedPerHole));
    expect(r.total).toBe(94);
    expect(r.perHoleScores).toEqual(expectedPerHole);
  });

  it('10.5: Empty holes → { perHoleScores: [], total: 0 }', () => {
    const r = calculateChapmanTotal([]);
    record('10.5', 'empty holes array', '{ [], 0 }', `${JSON.stringify(r.perHoleScores)} total ${r.total}`, r.perHoleScores.length === 0 && r.total === 0);
    expect(r.perHoleScores).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('10.6: Partial 9-hole round (front 9)', () => {
    // alternateShots: [3,4,1,5,3,3,4,3,4] sum=30
    // perHoleScores: [5,6,3,7,5,5,6,5,6]
    // total = 9 × 2 + 30 = 48
    const altShots = [3, 4, 1, 5, 3, 3, 4, 3, 4];
    const holes: ChapmanHoleScore[] = altShots.map((alt) => ({
      driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1,
      selectedBall: 'B', alternateShots: alt,
    }));
    const r = calculateChapmanTotal(holes);
    const expectedPerHole = altShots.map((alt) => 2 + alt);
    record('10.6', '9-hole front Chapman', 'total 48, perHole [5,6,3,7,5,5,6,5,6]', `total ${r.total}`, r.total === 48 && JSON.stringify(r.perHoleScores) === JSON.stringify(expectedPerHole));
    expect(r.total).toBe(48);
    expect(r.perHoleScores).toEqual(expectedPerHole);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SIDE-GAME COUNTERS — Tier A (pure auto-detect from HoleScore data)
// ═══════════════════════════════════════════════════════════════════════
// arnies, hogans: scan per-player per-hole HoleScore data and count
// qualifying holes. Par 3 holes have fir === null and are excluded from
// both (no fairway off the tee). trash: parametric composition over the
// small "junk" bets — caller passes per-player counts, function sums.
// No persistence scaffolding required for these three — they're pure
// functions over data the live scoring path already captures.

describe('SIDE-GAME COUNTERS — ARNIES (calculateArniesCount)', () => {
  it('A.1: Single qualifying hole — par with !fir && !isGir', () => {
    // Hole 1, par 4: gross 4 (par), missed fairway, putts 2 → gross-putts=2 > par-2=2 → NOT GIR (regulation requires 2 putts to be on green, i.e., reached green in par-2 strokes or fewer)
    // Wait: isGIR formula = (gross - putts) <= (par - 2). For gross=4, putts=2, par=4: (4-2)=2 <= (4-2)=2 → TRUE, IS GIR.
    // So to NOT be GIR, we need (gross - putts) > (par - 2). E.g., gross=4, putts=1 → 3>2 TRUE → not GIR (held green in 3, one-putt).
    // Build the scenario: par 4, gross 4, fir false, putts 1 → made par via long putt off the green (chip-in equivalent). Not FIR, not GIR. Arnie.
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(4, 1, false) },
    ]);
    const holes = [makeHole(1, 4)];
    const counts = calculateArniesCount(scores, holes);
    record('A.1', 'par-4 chip-in: gross 4 putts 1 fir false', 'p1=1', `p1=${counts.get('p1')}`, counts.get('p1') === 1);
    expect(counts.get('p1')).toBe(1);
  });

  it('A.2: Non-qualifying — par 3 (fir null, excluded)', () => {
    // Par 3 holes have fir === null; arnies need fir === false strictly
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(3, 1, null) },
    ]);
    const counts = calculateArniesCount(scores, [makeHole(1, 3)]);
    record('A.2', 'par-3 hole, fir=null', 'no arnies', `p1=${counts.get('p1') ?? 0}`, !counts.has('p1'));
    expect(counts.has('p1')).toBe(false);
  });

  it('A.3: Non-qualifying — fir true (hit the fairway, so not Arnie)', () => {
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(4, 2, true) },
    ]);
    const counts = calculateArniesCount(scores, [makeHole(1, 4)]);
    expect(counts.has('p1')).toBe(false);
  });

  it('A.4: Non-qualifying — GIR (hit green in regulation, so not Arnie)', () => {
    // par 4, gross 4, fir false, putts 2 → (4-2)=2 <= (4-2)=2 → IS GIR → not Arnie
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(4, 2, false) },
    ]);
    const counts = calculateArniesCount(scores, [makeHole(1, 4)]);
    expect(counts.has('p1')).toBe(false);
  });

  it('A.5: Non-qualifying — bogey (over par)', () => {
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(5, 1, false) },
    ]);
    const counts = calculateArniesCount(scores, [makeHole(1, 4)]);
    expect(counts.has('p1')).toBe(false);
  });

  it('A.6: Multi-player partial round — independent counts', () => {
    // Hole 1 (par 4): p1 makes Arnie (4 / 1 / false), p2 bogey
    // Hole 2 (par 5): p1 par with GIR (no Arnie), p2 birdie via Arnie route (4/1/false → 4 strokes, putts 1 → green in 3, one-putt → !GIR, !fir)
    // Hole 3 (par 3): both par 3s — excluded
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(4, 1, false) }, // Arnie
      { hole: 1, playerId: 'p2', score: makeScore(5, 2, false) }, // bogey, no Arnie
      { hole: 2, playerId: 'p1', score: makeScore(5, 2, true) },  // par via fairway, no Arnie
      { hole: 2, playerId: 'p2', score: makeScore(4, 1, false) }, // birdie scramble: !fir, putts 1, gross-putts=3, par-2=3 → 3<=3 IS GIR → no Arnie
      { hole: 3, playerId: 'p1', score: makeScore(3, 2, null) },  // par 3, excluded
      { hole: 3, playerId: 'p2', score: makeScore(3, 2, null) },  // par 3, excluded
    ]);
    const holes = [makeHole(1, 4), makeHole(2, 5), makeHole(3, 3)];
    const counts = calculateArniesCount(scores, holes);
    record('A.6', 'multi-player partial round', 'p1=1, p2=0', `p1=${counts.get('p1')} p2=${counts.get('p2') ?? 0}`, counts.get('p1') === 1 && !counts.has('p2'));
    expect(counts.get('p1')).toBe(1);
    expect(counts.has('p2')).toBe(false);
  });

  it('A.7: Empty scores → empty counts map', () => {
    const counts = calculateArniesCount(new Map(), [makeHole(1, 4)]);
    expect(counts.size).toBe(0);
  });
});

describe('SIDE-GAME COUNTERS — HOGANS (calculateHogansCount)', () => {
  it('H.1: All four conditions met — par 4 par with fir + GIR + 2-putt', () => {
    // par 4, gross 4, fir true, putts 2 → (4-2)=2 <= (4-2)=2 IS GIR, 2-putt, par or better → Hogan
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(4, 2, true) },
    ]);
    const counts = calculateHogansCount(scores, [makeHole(1, 4)]);
    record('H.1', 'par-4: 4/2/true (par+FIR+GIR+2-putt)', 'p1=1', `p1=${counts.get('p1')}`, counts.get('p1') === 1);
    expect(counts.get('p1')).toBe(1);
  });

  it('H.2: Fail FIR — same scoring shape but fir false', () => {
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(4, 2, false) },
    ]);
    const counts = calculateHogansCount(scores, [makeHole(1, 4)]);
    expect(counts.has('p1')).toBe(false);
  });

  it('H.3: Fail GIR — fir true but missed green', () => {
    // par 4, gross 4, fir true, putts 1 → (4-1)=3 > (4-2)=2 → not GIR (got up-and-down)
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(4, 1, true) },
    ]);
    const counts = calculateHogansCount(scores, [makeHole(1, 4)]);
    expect(counts.has('p1')).toBe(false);
  });

  it('H.4: Fail putts<=2 — 3-putt par 5', () => {
    // par 5, gross 5, fir true, putts 3 → (5-3)=2 <= (5-2)=3 IS GIR, but 3 putts > 2 → no Hogan
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(5, 3, true) },
    ]);
    const counts = calculateHogansCount(scores, [makeHole(1, 5)]);
    expect(counts.has('p1')).toBe(false);
  });

  it('H.5: Fail par-or-better — bogey with FIR+GIR+2-putt', () => {
    // par 4, gross 5, fir true, putts 2 → (5-2)=3 > (4-2)=2 → not GIR anyway (and bogey)
    // To isolate the par-or-better fail: need GIR + 2-putt + FIR but gross > par. Math requires putts <= par-2 to be GIR, but gross = par+1 means strokes-to-green = (par+1)-2 = par-1 > par-2, not GIR.
    // The "par or better" check is therefore co-implied by FIR+GIR+2-putt at par-or-better in stable golf: if you hit GIR in regulation and 2-putt, you score par (or better via 1-putt → counted) or bogey only if you took an extra penalty stroke between green and hole.
    // So a real-world fail-par with the other three conditions is unusual. Construct it: par 4, gross 5, fir true, putts 2, gross-putts=3 → 3 > 2 NOT GIR. So this isn't a clean isolation test; H.5 is "non-par" coverage via a realistic over-par case that also fails GIR.
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(5, 2, true) }, // bogey, also not GIR
    ]);
    const counts = calculateHogansCount(scores, [makeHole(1, 4)]);
    expect(counts.has('p1')).toBe(false);
  });

  it('H.6: Par 3 excluded — fir === null', () => {
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(3, 2, null) },
    ]);
    const counts = calculateHogansCount(scores, [makeHole(1, 3)]);
    expect(counts.has('p1')).toBe(false);
  });

  it('H.7: Multi-player — p1 Hogan, p2 misses on putts', () => {
    const scores = makeAllScores([
      { hole: 1, playerId: 'p1', score: makeScore(4, 2, true) },  // Hogan
      { hole: 1, playerId: 'p2', score: makeScore(5, 3, true) },  // FIR but 3-putt bogey, no Hogan
      { hole: 2, playerId: 'p1', score: makeScore(5, 2, true) },  // par 5 with FIR + 2-putt — check GIR: (5-2)=3 <= (5-2)=3 IS GIR → Hogan
      { hole: 2, playerId: 'p2', score: makeScore(5, 2, true) },  // same → Hogan
    ]);
    const holes = [makeHole(1, 4), makeHole(2, 5)];
    const counts = calculateHogansCount(scores, holes);
    record('H.7', 'p1 two Hogans, p2 one Hogan', 'p1=2 p2=1', `p1=${counts.get('p1')} p2=${counts.get('p2')}`, counts.get('p1') === 2 && counts.get('p2') === 1);
    expect(counts.get('p1')).toBe(2);
    expect(counts.get('p2')).toBe(1);
  });

  it('H.8: Empty scores → empty counts map', () => {
    const counts = calculateHogansCount(new Map(), [makeHole(1, 4)]);
    expect(counts.size).toBe(0);
  });
});

describe('SIDE-GAME COUNTERS — TRASH (calculateTrashTotal)', () => {
  it('T.1: Full subset — sums all four components', () => {
    const total = calculateTrashTotal({ greenies: 3, sandies: 1, bark: 2, arnies: 4 });
    record('T.1', '3+1+2+4', '10', String(total), total === 10);
    expect(total).toBe(10);
  });

  it('T.2: Empty input → 0', () => {
    const total = calculateTrashTotal({});
    record('T.2', 'empty record', '0', String(total), total === 0);
    expect(total).toBe(0);
  });

  it('T.3: Partial subset — only greenies + arnies', () => {
    // Caller chose to track only two component games this round
    const total = calculateTrashTotal({ greenies: 2, arnies: 3 });
    record('T.3', 'partial: greenies 2 + arnies 3', '5', String(total), total === 5);
    expect(total).toBe(5);
  });

  it('T.4: Zeros explicit ≡ missing keys', () => {
    const zeros = calculateTrashTotal({ greenies: 0, sandies: 0, bark: 0, arnies: 0 });
    const empty = calculateTrashTotal({});
    expect(zeros).toBe(empty);
    expect(zeros).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SIDE-GAME COUNTERS — Tier B (toast-confirmed via persistence slice)
// ═══════════════════════════════════════════════════════════════════════
// Sandies + Barkies: count `true` entries in boolean sub-slices. Tested
// shape: Map<playerId, Map<holeNumber, boolean>>. The single-source
// helper countConfirmedBoolean is shared; both engines just delegate.
// Poleys: count entries where distance > POLEYS_THRESHOLD_FEET (4 ft,
// hardcoded per beta decision). Strict greater-than — 4 ft = NOT a poley.

function makeBooleanSlice(
  rows: Array<{ playerId: string; hole: number; value: boolean }>,
): SideGameBooleanSlice {
  const m = new Map<string, Map<number, boolean>>();
  for (const r of rows) {
    if (!m.has(r.playerId)) m.set(r.playerId, new Map());
    m.get(r.playerId)!.set(r.hole, r.value);
  }
  return m;
}
function makeNumericSlice(
  rows: Array<{ playerId: string; hole: number; value: number }>,
): SideGameNumericSlice {
  const m = new Map<string, Map<number, number>>();
  for (const r of rows) {
    if (!m.has(r.playerId)) m.set(r.playerId, new Map());
    m.get(r.playerId)!.set(r.hole, r.value);
  }
  return m;
}

describe('SIDE-GAME COUNTERS — SANDIES (calculateSandiesCount)', () => {
  it('S.1: Single confirmed entry → p1 count 1', () => {
    const slice = makeBooleanSlice([
      { playerId: 'p1', hole: 1, value: true },
    ]);
    const counts = calculateSandiesCount(slice);
    record('S.1', '1 confirmed sandie', 'p1=1', `p1=${counts.get('p1')}`, counts.get('p1') === 1);
    expect(counts.get('p1')).toBe(1);
  });

  it('S.2: Multiple confirmed for one player → counted correctly', () => {
    const slice = makeBooleanSlice([
      { playerId: 'p1', hole: 1, value: true },
      { playerId: 'p1', hole: 5, value: true },
      { playerId: 'p1', hole: 12, value: true },
    ]);
    const counts = calculateSandiesCount(slice);
    record('S.2', '3 sandies for p1', 'p1=3', `p1=${counts.get('p1')}`, counts.get('p1') === 3);
    expect(counts.get('p1')).toBe(3);
  });

  it('S.3: Mix of true/false — only true entries counted', () => {
    // Dismissed events (false) shouldn't count even if persisted as false.
    // (Part 3 handler may persist false on dismiss, or just not write — engine handles either.)
    const slice = makeBooleanSlice([
      { playerId: 'p1', hole: 1, value: true },
      { playerId: 'p1', hole: 2, value: false },
      { playerId: 'p1', hole: 3, value: true },
      { playerId: 'p1', hole: 4, value: false },
    ]);
    const counts = calculateSandiesCount(slice);
    record('S.3', '2 true, 2 false → count 2', 'p1=2', `p1=${counts.get('p1')}`, counts.get('p1') === 2);
    expect(counts.get('p1')).toBe(2);
  });

  it('S.4: Multi-player independent counts', () => {
    const slice = makeBooleanSlice([
      { playerId: 'p1', hole: 1, value: true },
      { playerId: 'p1', hole: 5, value: true },
      { playerId: 'p2', hole: 3, value: true },
      { playerId: 'p3', hole: 1, value: false }, // dismissed → no count
    ]);
    const counts = calculateSandiesCount(slice);
    record('S.4', 'p1=2, p2=1, p3 dismissed', 'p1=2 p2=1 p3=absent', `p1=${counts.get('p1')} p2=${counts.get('p2')} p3=${counts.get('p3') ?? 0}`, counts.get('p1') === 2 && counts.get('p2') === 1 && !counts.has('p3'));
    expect(counts.get('p1')).toBe(2);
    expect(counts.get('p2')).toBe(1);
    expect(counts.has('p3')).toBe(false); // all false → player omitted from result
  });

  it('S.5: Empty slice → empty result map', () => {
    const counts = calculateSandiesCount(new Map());
    expect(counts.size).toBe(0);
  });
});

describe('SIDE-GAME COUNTERS — BARKIES (calculateBarkiesCount)', () => {
  it('B.1: Single confirmed barkie → p1 count 1', () => {
    const slice = makeBooleanSlice([
      { playerId: 'p1', hole: 6, value: true },
    ]);
    const counts = calculateBarkiesCount(slice);
    record('B.1', '1 barkie p1', 'p1=1', `p1=${counts.get('p1')}`, counts.get('p1') === 1);
    expect(counts.get('p1')).toBe(1);
  });

  it('B.2: Multi-player independent — same engine as sandies, exercise on different data', () => {
    const slice = makeBooleanSlice([
      { playerId: 'p1', hole: 3, value: true },
      { playerId: 'p2', hole: 3, value: true },
      { playerId: 'p2', hole: 12, value: true },
      { playerId: 'p3', hole: 15, value: false },
    ]);
    const counts = calculateBarkiesCount(slice);
    record('B.2', 'p1=1, p2=2, p3=dismissed', 'p1=1 p2=2 p3=absent', `p1=${counts.get('p1')} p2=${counts.get('p2')} p3=${counts.get('p3') ?? 0}`, counts.get('p1') === 1 && counts.get('p2') === 2 && !counts.has('p3'));
    expect(counts.get('p1')).toBe(1);
    expect(counts.get('p2')).toBe(2);
    expect(counts.has('p3')).toBe(false);
  });

  it('B.3: Empty slice → empty result', () => {
    const counts = calculateBarkiesCount(new Map());
    expect(counts.size).toBe(0);
  });
});

describe('SIDE-GAME COUNTERS — POLEYS (calculatePoleysCount, threshold 4 ft strict)', () => {
  it('P.1: Distance > 4 counted (5 ft poley)', () => {
    const slice = makeNumericSlice([
      { playerId: 'p1', hole: 7, value: 5 },
    ]);
    const counts = calculatePoleysCount(slice);
    record('P.1', '5 ft one-putt', 'p1=1', `p1=${counts.get('p1')}`, counts.get('p1') === 1);
    expect(counts.get('p1')).toBe(1);
  });

  it('P.2: Distance EXACTLY 4 → NOT counted (strict greater-than)', () => {
    const slice = makeNumericSlice([
      { playerId: 'p1', hole: 7, value: 4 },
    ]);
    const counts = calculatePoleysCount(slice);
    record('P.2', '4 ft (boundary, ">" strict)', 'p1=absent (0 not counted)', `p1=${counts.get('p1') ?? 0}`, !counts.has('p1'));
    expect(counts.has('p1')).toBe(false);
  });

  it('P.3: Threshold constant is 4 (locks the hardcoded beta value)', () => {
    record('P.3', 'POLEYS_THRESHOLD_FEET constant', '4', String(POLEYS_THRESHOLD_FEET), POLEYS_THRESHOLD_FEET === 4);
    expect(POLEYS_THRESHOLD_FEET).toBe(4);
  });

  it('P.4: Mixed qualifying + non-qualifying distances for one player', () => {
    // p1: 3 ft (no), 4 ft (no, boundary), 5 ft (yes), 12 ft (yes), 35 ft (yes) → 3 poleys
    const slice = makeNumericSlice([
      { playerId: 'p1', hole: 1, value: 3 },
      { playerId: 'p1', hole: 2, value: 4 },
      { playerId: 'p1', hole: 3, value: 5 },
      { playerId: 'p1', hole: 4, value: 12 },
      { playerId: 'p1', hole: 5, value: 35 },
    ]);
    const counts = calculatePoleysCount(slice);
    record('P.4', '5 distances, 3 qualify (>4)', 'p1=3', `p1=${counts.get('p1')}`, counts.get('p1') === 3);
    expect(counts.get('p1')).toBe(3);
  });

  it('P.5: Multi-player independent counts', () => {
    const slice = makeNumericSlice([
      { playerId: 'p1', hole: 1, value: 6 },
      { playerId: 'p1', hole: 7, value: 20 },
      { playerId: 'p2', hole: 5, value: 4 }, // boundary, no count
      { playerId: 'p3', hole: 9, value: 8 },
    ]);
    const counts = calculatePoleysCount(slice);
    record('P.5', 'p1=2, p2=boundary-skip, p3=1', 'p1=2 p3=1 p2 absent', `p1=${counts.get('p1')} p2=${counts.get('p2') ?? 0} p3=${counts.get('p3')}`, counts.get('p1') === 2 && counts.get('p3') === 1 && !counts.has('p2'));
    expect(counts.get('p1')).toBe(2);
    expect(counts.has('p2')).toBe(false);
    expect(counts.get('p3')).toBe(1);
  });

  it('P.6: Empty slice → empty result', () => {
    const counts = calculatePoleysCount(new Map());
    expect(counts.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3-PUTT POKER ROUND ENGINE
// ═══════════════════════════════════════════════════════════════════════
// Tests the CURRENT mechanic (good putting earns cards, bad putting
// feeds the pot, last 3-putter holds the cosmetic chip, best hand wins
// pot). Engine is pure + deck-as-input — tests use a fixture deck so
// assertions can name exact cards. The doc-spec at scoring.ts:492-503
// is stale; encoded behavior matches src/scoring/useScoringState.ts
// lines 1033-1108 (the live implementation).

// Fixture deck, top-of-deck first. Card 0 = A♥, then K♥, Q♥, J♥, 10♥
// (positions 0-4 form a royal flush in hearts).
const FIXTURE_DECK: Card[] = [
  { suit: 'hearts',   rank: 'A',  value: 14 },
  { suit: 'hearts',   rank: 'K',  value: 13 },
  { suit: 'hearts',   rank: 'Q',  value: 12 },
  { suit: 'hearts',   rank: 'J',  value: 11 },
  { suit: 'hearts',   rank: '10', value: 10 },
  { suit: 'diamonds', rank: '9',  value: 9 },
  { suit: 'diamonds', rank: '8',  value: 8 },
  { suit: 'diamonds', rank: '7',  value: 7 },
  { suit: 'clubs',    rank: '6',  value: 6 },
  { suit: 'clubs',    rank: '5',  value: 5 },
  { suit: 'spades',   rank: '4',  value: 4 },
  { suit: 'spades',   rank: '3',  value: 3 },
];

function makeScoreMap(
  rows: Array<{ hole: number; playerId: string; gross: number; putts: number }>,
): Map<number, Map<string, HoleScore>> {
  const m = new Map<number, Map<string, HoleScore>>();
  for (const r of rows) {
    if (!m.has(r.hole)) m.set(r.hole, new Map());
    m.get(r.hole)!.set(r.playerId, { gross: r.gross, putts: r.putts, fir: null });
  }
  return m;
}

function makeHoles(...nums: number[]): HoleData[] {
  return nums.map((n) => ({ number: n, par: 4, strokeIndex: n }));
}

describe('3-PUTT POKER — cardsToDealForHole', () => {
  it('CD.1: chip-in (putts=0, gross>0) → 2 cards', () => {
    const n = cardsToDealForHole({ putts: 0, gross: 3 });
    record('CD.1', 'chip-in (0 putts, gross=3)', '2', String(n), n === 2);
    expect(n).toBe(2);
  });
  it('CD.2: one-putt (putts=1) → 1 card', () => {
    const n = cardsToDealForHole({ putts: 1, gross: 4 });
    record('CD.2', '1 putt', '1', String(n), n === 1);
    expect(n).toBe(1);
  });
  it('CD.3: two-putt → 0 cards', () => {
    const n = cardsToDealForHole({ putts: 2, gross: 4 });
    record('CD.3', '2 putts', '0', String(n), n === 0);
    expect(n).toBe(0);
  });
  it('CD.4: three-putt → 0 cards (bad putting feeds pot, NOT cards)', () => {
    const n = cardsToDealForHole({ putts: 3, gross: 5 });
    record('CD.4', '3 putts (feeds pot)', '0', String(n), n === 0);
    expect(n).toBe(0);
  });
  it('CD.5: empty hole (putts=0, gross=0) → 0 cards (not a chip-in)', () => {
    const n = cardsToDealForHole({ putts: 0, gross: 0 });
    record('CD.5', '0 putts, 0 gross (not played)', '0', String(n), n === 0);
    expect(n).toBe(0);
  });
});

describe('3-PUTT POKER — countThreePutts / countOnePutts / countChipIns', () => {
  it('TP.1: count 3-putts across players + holes', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 5, putts: 3 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 2 },
      { hole: 2, playerId: 'p1', gross: 6, putts: 3 },
      { hole: 2, playerId: 'p2', gross: 5, putts: 1 },
      { hole: 3, playerId: 'p1', gross: 4, putts: 2 },
      { hole: 3, playerId: 'p2', gross: 7, putts: 4 },
    ]);
    const c = countThreePutts(scores);
    record('TP.1', '2 players, 3 holes', 'p1=2 p2=1', `p1=${c.get('p1')} p2=${c.get('p2')}`, c.get('p1') === 2 && c.get('p2') === 1);
    expect(c.get('p1')).toBe(2);
    expect(c.get('p2')).toBe(1);
  });
  it('OP.1: count one-putts (putts===1 strict)', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 3, putts: 1 },
      { hole: 1, playerId: 'p2', gross: 3, putts: 0 }, // chip-in, NOT one-putt
      { hole: 2, playerId: 'p1', gross: 4, putts: 1 },
      { hole: 2, playerId: 'p2', gross: 4, putts: 2 },
    ]);
    const c = countOnePutts(scores);
    record('OP.1', 'chip-in excluded from one-putts', 'p1=2 p2=absent', `p1=${c.get('p1')} p2=${c.get('p2') ?? 0}`, c.get('p1') === 2 && !c.has('p2'));
    expect(c.get('p1')).toBe(2);
    expect(c.has('p2')).toBe(false);
  });
  it('CI.1: count chip-ins (putts=0 AND gross>0)', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 3, putts: 0 }, // chip-in
      { hole: 2, playerId: 'p1', gross: 0, putts: 0 }, // not played — NOT a chip-in
      { hole: 3, playerId: 'p1', gross: 4, putts: 0 }, // chip-in
      { hole: 1, playerId: 'p2', gross: 4, putts: 2 },
    ]);
    const c = countChipIns(scores);
    record('CI.1', 'gross=0 not counted as chip-in', 'p1=2 p2=absent', `p1=${c.get('p1')} p2=${c.get('p2') ?? 0}`, c.get('p1') === 2 && !c.has('p2'));
    expect(c.get('p1')).toBe(2);
    expect(c.has('p2')).toBe(false);
  });
});

describe('3-PUTT POKER — computePot', () => {
  const ante = 1;
  const threePuttPenalty = 1;
  it('PT.1: ante-only baseline (no 3-putts) → playerCount × ante', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 4, putts: 2 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 1 },
    ]);
    const pot = computePot({ playerCount: 2, ante, threePuttPenalty, scores });
    record('PT.1', 'no 3-putts, 2 players × $1 ante', '2', String(pot), pot === 2);
    expect(pot).toBe(2);
  });
  it('PT.2: one 3-putt → ante + $1 penalty', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 5, putts: 3 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 2 },
    ]);
    const pot = computePot({ playerCount: 2, ante, threePuttPenalty, scores });
    record('PT.2', '1×3-putt (extra=1)', '3', String(pot), pot === 3);
    expect(pot).toBe(3);
  });
  it('PT.3: 4-putt contributes 2 (extra = putts-2 = 2)', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 6, putts: 4 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 2 },
    ]);
    const pot = computePot({ playerCount: 2, ante, threePuttPenalty, scores });
    record('PT.3', '1×4-putt (extra=2)', '4', String(pot), pot === 4);
    expect(pot).toBe(4);
  });
  it('PT.4: mixed — one 3-putt + one 4-putt across holes', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 5, putts: 3 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 1 },
      { hole: 2, playerId: 'p1', gross: 6, putts: 4 },
      { hole: 2, playerId: 'p2', gross: 5, putts: 2 },
    ]);
    const pot = computePot({ playerCount: 2, ante, threePuttPenalty, scores });
    record('PT.4', 'ante 2 + 3-putt 1 + 4-putt 2 = 5', '5', String(pot), pot === 5);
    expect(pot).toBe(5);
  });
});

describe('3-PUTT POKER — computeWorstPutter (cosmetic, payout-neutral)', () => {
  const playerIds = ['p1', 'p2'];
  it('WP.1: single 3-putt → that player', () => {
    const scores = makeScoreMap([
      { hole: 5, playerId: 'p1', gross: 5, putts: 3 },
      { hole: 5, playerId: 'p2', gross: 4, putts: 2 },
    ]);
    const w = computeWorstPutter(scores, makeHoles(1, 2, 3, 4, 5, 6), playerIds);
    record('WP.1', 'only p1 3-putts', 'p1', String(w), w === 'p1');
    expect(w).toBe('p1');
  });
  it('WP.2: two 3-putts on different holes → LAST hole wins', () => {
    const scores = makeScoreMap([
      { hole: 3, playerId: 'p1', gross: 5, putts: 3 }, // first 3-putt
      { hole: 7, playerId: 'p2', gross: 5, putts: 3 }, // later → wins
    ]);
    const w = computeWorstPutter(scores, makeHoles(1, 2, 3, 4, 5, 6, 7, 8), playerIds);
    record('WP.2', 'p1 hole 3, p2 hole 7 (last)', 'p2', String(w), w === 'p2');
    expect(w).toBe('p2');
  });
  it('WP.3: two 3-putts SAME hole → LAST playerId in supplied order wins', () => {
    const scores = makeScoreMap([
      { hole: 4, playerId: 'p1', gross: 5, putts: 3 },
      { hole: 4, playerId: 'p2', gross: 5, putts: 3 },
    ]);
    const w = computeWorstPutter(scores, makeHoles(1, 2, 3, 4, 5), playerIds);
    record('WP.3', 'same hole, both 3-putt, p2 last in order', 'p2', String(w), w === 'p2');
    expect(w).toBe('p2');
  });
  it('WP.4: no 3-putts anywhere → null', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 4, putts: 2 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 1 },
    ]);
    const w = computeWorstPutter(scores, makeHoles(1, 2), playerIds);
    record('WP.4', 'no 3-putts', 'null', String(w), w === null);
    expect(w).toBe(null);
  });
});

describe('3-PUTT POKER — dealCards (deck-as-input, deterministic)', () => {
  const playerIds = ['p1', 'p2'];
  it('DK.1: deals correct count + correct cards in hole×player order', () => {
    // Hole 1: p1 chip-in (2 cards: idx 0,1), p2 one-putt (1 card: idx 2).
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 3, putts: 0 },
      { hole: 1, playerId: 'p2', gross: 3, putts: 1 },
    ]);
    const { perPlayer, deckCursor } = dealCards({
      scores, holesInOrder: makeHoles(1), playerIds, deck: FIXTURE_DECK,
    });
    const p1 = perPlayer.get('p1')!;
    const p2 = perPlayer.get('p2')!;
    const ok = p1.length === 2 && p1[0].rank === 'A' && p1[1].rank === 'K'
            && p2.length === 1 && p2[0].rank === 'Q'
            && deckCursor === 3;
    record('DK.1', 'p1 chip-in + p2 one-putt', 'p1=[A,K] p2=[Q] cur=3', `p1=[${p1.map((c) => c.rank).join(',')}] p2=[${p2.map((c) => c.rank).join(',')}] cur=${deckCursor}`, ok);
    expect(p1.map((c) => c.rank)).toEqual(['A', 'K']);
    expect(p2.map((c) => c.rank)).toEqual(['Q']);
    expect(deckCursor).toBe(3);
  });
  it('DK.2: cursor advances correctly across multiple holes', () => {
    // H1: p1 one-putt (1), p2 chip-in (2).
    // H2: p1 chip-in (2), p2 one-putt (1).
    // Expected sequence: p1=A, p2=K,Q, p1=J,10, p2=9. Cursor=6.
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 4, putts: 1 },
      { hole: 1, playerId: 'p2', gross: 3, putts: 0 },
      { hole: 2, playerId: 'p1', gross: 3, putts: 0 },
      { hole: 2, playerId: 'p2', gross: 4, putts: 1 },
    ]);
    const { perPlayer, deckCursor } = dealCards({
      scores, holesInOrder: makeHoles(1, 2), playerIds, deck: FIXTURE_DECK,
    });
    const p1Ranks = perPlayer.get('p1')!.map((c) => c.rank);
    const p2Ranks = perPlayer.get('p2')!.map((c) => c.rank);
    const ok = p1Ranks.join(',') === 'A,J,10' && p2Ranks.join(',') === 'K,Q,9' && deckCursor === 6;
    record('DK.2', '2 holes mixed dealing', 'p1=A,J,10 p2=K,Q,9 cur=6', `p1=${p1Ranks.join(',')} p2=${p2Ranks.join(',')} cur=${deckCursor}`, ok);
    expect(p1Ranks).toEqual(['A', 'J', '10']);
    expect(p2Ranks).toEqual(['K', 'Q', '9']);
    expect(deckCursor).toBe(6);
  });
  it('DK.3: idempotency — same input → same output (engine is pure)', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 3, putts: 0 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 1 },
    ]);
    const args = { scores, holesInOrder: makeHoles(1), playerIds, deck: FIXTURE_DECK };
    const a = dealCards(args);
    const b = dealCards(args);
    const ok = a.deckCursor === b.deckCursor
            && JSON.stringify(Array.from(a.perPlayer.entries())) === JSON.stringify(Array.from(b.perPlayer.entries()));
    record('DK.3', 'pure: two calls deep-equal', 'equal', ok ? 'equal' : 'DIFFER', ok);
    expect(ok).toBe(true);
  });
});

describe('3-PUTT POKER — evaluatePokerRound (end-to-end)', () => {
  const playerIds = ['p1', 'p2'];
  const ante = 1;
  const threePuttPenalty = 1;

  it('PR.1: fixture round → p1 royal flush, pot=2 (no 3-putts), payouts sum to 0', () => {
    // 4 holes; deck-dealing trace: p1 collects A♥K♥Q♥J♥10♥ → royal flush.
    //   H1: p1 chip-in (2 cards 0,1=A♥,K♥); p2 two-putt (0).
    //   H2: p1 chip-in (2 cards 2,3=Q♥,J♥); p2 two-putt (0).
    //   H3: p1 one-putt (1 card 4=10♥);     p2 one-putt (1 card 5=9♦).
    //   H4: both two-putt (0 cards).
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 3, putts: 0 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 2 },
      { hole: 2, playerId: 'p1', gross: 3, putts: 0 },
      { hole: 2, playerId: 'p2', gross: 4, putts: 2 },
      { hole: 3, playerId: 'p1', gross: 4, putts: 1 },
      { hole: 3, playerId: 'p2', gross: 4, putts: 1 },
      { hole: 4, playerId: 'p1', gross: 4, putts: 2 },
      { hole: 4, playerId: 'p2', gross: 4, putts: 2 },
    ]);
    const r = evaluatePokerRound({
      scores, holesInOrder: makeHoles(1, 2, 3, 4), playerIds, deck: FIXTURE_DECK, ante, threePuttPenalty,
    });
    const p1Eval = r.perPlayer.get('p1')!.evaluation!;
    const p2Eval = r.perPlayer.get('p2')!.evaluation!;
    const payoutSum = Array.from(r.payouts.values()).reduce((a, b) => a + b, 0);
    const ok = r.winnerId === 'p1'
            && p1Eval.rank === 'royal_flush'
            && r.pot === 2
            && r.payouts.get('p1') === 1   // +pot 2 - ante 1
            && r.payouts.get('p2') === -1  // -ante 1
            && payoutSum === 0;
    record('PR.1', 'p1 royal flush, pot=$2, sum=0',
      "winner=p1 rank=royal_flush pot=2 sum=0",
      `winner=${r.winnerId} rank=${p1Eval.rank} pot=${r.pot} sum=${payoutSum}`,
      ok);
    expect(r.winnerId).toBe('p1');
    expect(p1Eval.rank).toBe('royal_flush');
    expect(p2Eval.rank).toBe('high_card');
    expect(r.pot).toBe(2);
    expect(r.payouts.get('p1')).toBe(1);
    expect(r.payouts.get('p2')).toBe(-1);
    expect(payoutSum).toBe(0);
  });

  it('PR.2: 3-putt penalty contributor pays more (ledger nets to 0)', () => {
    // Same dealing pattern as PR.1 but p2 also 3-putts on hole 4 (extra=1).
    // Pot = 2 (ante) + 1 (p2's 3-putt) = 3.
    // p1 contributed: ante 1. Won pot 3. Net = +2.
    // p2 contributed: ante 1 + penalty 1 = 2. Won 0. Net = -2.
    // Sum = 0.
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 3, putts: 0 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 2 },
      { hole: 2, playerId: 'p1', gross: 3, putts: 0 },
      { hole: 2, playerId: 'p2', gross: 4, putts: 2 },
      { hole: 3, playerId: 'p1', gross: 4, putts: 1 },
      { hole: 3, playerId: 'p2', gross: 4, putts: 1 },
      { hole: 4, playerId: 'p1', gross: 4, putts: 2 },
      { hole: 4, playerId: 'p2', gross: 5, putts: 3 },
    ]);
    const r = evaluatePokerRound({
      scores, holesInOrder: makeHoles(1, 2, 3, 4), playerIds, deck: FIXTURE_DECK, ante, threePuttPenalty,
    });
    const payoutSum = Array.from(r.payouts.values()).reduce((a, b) => a + b, 0);
    const ok = r.winnerId === 'p1'
            && r.pot === 3
            && r.worstPutter === 'p2'
            && r.payouts.get('p1') === 2
            && r.payouts.get('p2') === -2
            && payoutSum === 0;
    record('PR.2', '+3-putt penalty, p2 pays more',
      "winner=p1 pot=3 worst=p2 p1=+2 p2=-2",
      `winner=${r.winnerId} pot=${r.pot} worst=${r.worstPutter} p1=${r.payouts.get('p1')} p2=${r.payouts.get('p2')}`,
      ok);
    expect(r.winnerId).toBe('p1');
    expect(r.pot).toBe(3);
    expect(r.worstPutter).toBe('p2');
    expect(r.payouts.get('p1')).toBe(2);
    expect(r.payouts.get('p2')).toBe(-2);
    expect(payoutSum).toBe(0);
  });

  it('PR.3: edge — all two-putts → no cards, no winner, pot voided (payouts all 0)', () => {
    const scores = makeScoreMap([
      { hole: 1, playerId: 'p1', gross: 4, putts: 2 },
      { hole: 1, playerId: 'p2', gross: 4, putts: 2 },
      { hole: 2, playerId: 'p1', gross: 4, putts: 2 },
      { hole: 2, playerId: 'p2', gross: 4, putts: 2 },
    ]);
    const r = evaluatePokerRound({
      scores, holesInOrder: makeHoles(1, 2), playerIds, deck: FIXTURE_DECK, ante, threePuttPenalty,
    });
    const payoutSum = Array.from(r.payouts.values()).reduce((a, b) => a + b, 0);
    const ok = r.winnerId === null
            && r.perPlayer.get('p1')!.evaluation === null
            && r.perPlayer.get('p2')!.evaluation === null
            && r.pot === 2 // ante-only — preserved on result for display, but
            && r.payouts.get('p1') === 0
            && r.payouts.get('p2') === 0
            && payoutSum === 0;
    record('PR.3', 'no cards earned → winner=null, payouts=0',
      "winner=null pot=2 payouts all 0 sum=0",
      `winner=${r.winnerId} pot=${r.pot} p1=${r.payouts.get('p1')} p2=${r.payouts.get('p2')} sum=${payoutSum}`,
      ok);
    expect(r.winnerId).toBe(null);
    expect(r.perPlayer.get('p1')!.evaluation).toBe(null);
    expect(r.pot).toBe(2);
    expect(r.payouts.get('p1')).toBe(0);
    expect(r.payouts.get('p2')).toBe(0);
    expect(payoutSum).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEAM-HANDICAP RULES ENGINE
// ═══════════════════════════════════════════════════════════════════════
// Pure preset + custom-rule arithmetic. The engine returns decimals;
// these tests assert against expected decimals using a 1e-9 epsilon
// (presets use 0.35 / 0.6 etc. which are not IEEE-754 exact).
//
// Coverage: each preset (TH.1–TH.6), the custom-rule override path
// (TH.7–TH.8) that proves the engine accepts arbitrary rules
// identically to presets, sort independence (TH.9), edges (TH.10–13),
// the format-resolver convenience (TH.14), and the two throw cases
// (TH.15–16) that fail loud on caller bugs.

const TH_EPS = 1e-9;
function thNear(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < TH_EPS;
}

describe('TEAM-HANDICAP — preset formulas', () => {
  it('TH.1: Scramble 2P [8,16] → 0.35×8 + 0.15×16 = 5.2', () => {
    const h = calculateTeamHandicap([8, 16], TEAM_HANDICAP_PRESETS.scramble_2p);
    const ok = thNear(h, 5.2);
    record('TH.1', 'Scramble 2P [8,16]', '5.2', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
  it('TH.2: Scramble 4P [4,10,16,22] → 0.25×4+0.20×10+0.15×16+0.10×22 = 7.6', () => {
    const h = calculateTeamHandicap([4, 10, 16, 22], TEAM_HANDICAP_PRESETS.scramble_4p);
    const ok = thNear(h, 7.6);
    record('TH.2', 'Scramble 4P [4,10,16,22]', '7.6', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
  it('TH.3: Chapman [6,14] → 0.60×6 + 0.40×14 = 9.2', () => {
    const h = calculateTeamHandicap([6, 14], TEAM_HANDICAP_PRESETS.chapman);
    const ok = thNear(h, 9.2);
    record('TH.3', 'Chapman [6,14]', '9.2', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
  it('TH.4: Pinehurst [6,14] === Chapman result (same preset object)', () => {
    const h = calculateTeamHandicap([6, 14], TEAM_HANDICAP_PRESETS.pinehurst);
    const same = TEAM_HANDICAP_PRESETS.pinehurst === TEAM_HANDICAP_PRESETS.chapman;
    const ok = thNear(h, 9.2) && same;
    record('TH.4', 'Pinehurst === Chapman', '9.2 & shared ref', `${h.toFixed(4)} shared=${same}`, ok);
    expect(ok).toBe(true);
  });
  it('TH.5: Greensomes [10,20] → 0.60×10 + 0.40×20 = 14.0', () => {
    const h = calculateTeamHandicap([10, 20], TEAM_HANDICAP_PRESETS.greensomes);
    const ok = thNear(h, 14.0);
    record('TH.5', 'Greensomes [10,20]', '14.0', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
  it('TH.6: Alt Shot [8,12] combined 50% → 0.5×(8+12) = 10.0 (textbook average)', () => {
    const h = calculateTeamHandicap([8, 12], TEAM_HANDICAP_PRESETS.alternate_shot);
    const ok = thNear(h, 10.0);
    record('TH.6', 'Alt Shot [8,12] 50% × sum', '10.0', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
});

describe('TEAM-HANDICAP — custom rule override (proves the capability)', () => {
  it('TH.7: same handicaps [8,16] with CUSTOM 50/50 weighted → 12.0 (vs preset 5.2)', () => {
    const custom: TeamHandicapRule = { method: 'weighted', weights: [0.5, 0.5] };
    const customResult = calculateTeamHandicap([8, 16], custom);
    const presetResult = calculateTeamHandicap([8, 16], TEAM_HANDICAP_PRESETS.scramble_2p);
    const ok = thNear(customResult, 12.0) && thNear(presetResult, 5.2) && !thNear(customResult, presetResult);
    record('TH.7', 'custom 50/50 vs preset 35/15', 'custom=12 preset=5.2 differ', `custom=${customResult.toFixed(2)} preset=${presetResult.toFixed(2)}`, ok);
    expect(ok).toBe(true);
  });
  it('TH.8: custom combined 75% on [10,20] → 0.75×30 = 22.5 (non-default percent)', () => {
    const custom: TeamHandicapRule = { method: 'combined', combinedPercent: 75 };
    const h = calculateTeamHandicap([10, 20], custom);
    const ok = thNear(h, 22.5);
    record('TH.8', 'custom combined 75%', '22.5', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
});

describe('TEAM-HANDICAP — sort independence + edges', () => {
  it('TH.9: unsorted input [16,8] → same result as sorted [8,16] (engine sorts internally)', () => {
    const a = calculateTeamHandicap([8, 16], TEAM_HANDICAP_PRESETS.scramble_2p);
    const b = calculateTeamHandicap([16, 8], TEAM_HANDICAP_PRESETS.scramble_2p);
    const ok = thNear(a, b) && thNear(a, 5.2);
    record('TH.9', 'unsorted [16,8] vs sorted [8,16]', 'equal, both 5.2', `a=${a.toFixed(4)} b=${b.toFixed(4)}`, ok);
    expect(ok).toBe(true);
  });
  it('TH.10: single handicap [8] weighted [0.35] → 2.8', () => {
    const h = calculateTeamHandicap([8], { method: 'weighted', weights: [0.35] });
    const ok = thNear(h, 2.8);
    record('TH.10', 'single [8] × 0.35', '2.8', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
  it('TH.11: equal handicaps [10,10] Scramble 2P → 0.35×10 + 0.15×10 = 5.0', () => {
    const h = calculateTeamHandicap([10, 10], TEAM_HANDICAP_PRESETS.scramble_2p);
    const ok = thNear(h, 5.0);
    record('TH.11', 'equal [10,10] Scramble 2P', '5.0', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
  it('TH.12: all-zero handicaps [0,0] any rule → 0', () => {
    const w = calculateTeamHandicap([0, 0], TEAM_HANDICAP_PRESETS.scramble_2p);
    const c = calculateTeamHandicap([0, 0], TEAM_HANDICAP_PRESETS.alternate_shot);
    const ok = w === 0 && c === 0;
    record('TH.12', '[0,0] any rule', '0,0', `${w},${c}`, ok);
    expect(ok).toBe(true);
  });
  it('TH.13: empty array [] → 0 (transient state, not a bug)', () => {
    const w = calculateTeamHandicap([], TEAM_HANDICAP_PRESETS.scramble_2p);
    const c = calculateTeamHandicap([], TEAM_HANDICAP_PRESETS.alternate_shot);
    const ok = w === 0 && c === 0;
    record('TH.13', 'empty []', '0,0', `${w},${c}`, ok);
    expect(ok).toBe(true);
  });
});

describe('TEAM-HANDICAP — format resolver + throw semantics', () => {
  it('TH.14: teamHandicapForFormat([8,16], "scramble") → 5.2 (dispatches to scramble_2p)', () => {
    const h = teamHandicapForFormat([8, 16], 'scramble');
    const ok = thNear(h, 5.2);
    record('TH.14', 'resolver scramble → 2P preset', '5.2', h.toFixed(4), ok);
    expect(ok).toBe(true);
  });
  it('TH.15: teamHandicapForFormat([...], "unknown_format") → throws (caller bug, fail loud)', () => {
    let threw = false;
    let msg = '';
    try {
      teamHandicapForFormat([8, 16], 'definitely_not_a_format');
    } catch (e: any) {
      threw = true;
      msg = String(e.message);
    }
    const ok = threw && msg.includes('definitely_not_a_format');
    record('TH.15', 'unknown format', 'throws with key in msg', threw ? `threw: ${msg}` : 'did NOT throw', ok);
    expect(ok).toBe(true);
  });
  it('TH.16: mismatched weights.length vs handicaps.length → throws', () => {
    let threw = false;
    let msg = '';
    try {
      calculateTeamHandicap([8, 16, 20], { method: 'weighted', weights: [0.5, 0.5] });
    } catch (e: any) {
      threw = true;
      msg = String(e.message);
    }
    const ok = threw && msg.includes('mismatch');
    record('TH.16', 'weights/handicaps length mismatch', 'throws', threw ? `threw: ${msg}` : 'did NOT throw', ok);
    expect(ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// MATCH PLAY FAMILY — formatMatchState (Layer B engine, Stage 1)
// ═══════════════════════════════════════════════════════════════════════

describe('MATCH PLAY — formatMatchState (mid-round states)', () => {
  it('MPF.1: 0 holes played → AS (no thru suffix)', () => {
    const r = formatMatchState(0, 0, 0, 18);
    record('MPF.1', 'fresh round: AS, currentDisplay "AS"', '"AS"/"AS"', `${r.status}/${r.currentDisplay}`, r.status === 'AS' && r.currentDisplay === 'AS' && r.isComplete === false);
  });

  it('MPF.2: A wins hole 1, 1 UP thru 1', () => {
    const r = formatMatchState(1, 0, 1, 18);
    record('MPF.2', 'A wins hole 1', '"UP"/"1 UP thru 1"', `${r.status}/${r.currentDisplay}`, r.status === 'UP' && r.currentDisplay === '1 UP thru 1' && r.leader === 'A' && r.lead === 1);
  });

  it('MPF.3: 2 wins for A, 1 for B, 1 halve, 4 played → 1 UP thru 4', () => {
    const r = formatMatchState(2, 1, 4, 18);
    record('MPF.3', '2-1-1 partial', '"UP"/"1 UP thru 4"', `${r.status}/${r.currentDisplay}`, r.status === 'UP' && r.currentDisplay === '1 UP thru 4' && r.lead === 1);
  });

  it('MPF.4: perspective=B with A leading → 1 DOWN thru 4', () => {
    const r = formatMatchState(2, 1, 4, 18, 'B');
    record('MPF.4', 'B perspective, A leads', '"DOWN"/"1 DOWN thru 4"', `${r.status}/${r.currentDisplay}`, r.status === 'DOWN' && r.currentDisplay === '1 DOWN thru 4' && r.leader === 'A');
  });

  it('MPF.5: All Square mid-round → AS thru N', () => {
    const r = formatMatchState(3, 3, 7, 18);
    record('MPF.5', 'tied mid-round', '"AS"/"AS thru 7"', `${r.status}/${r.currentDisplay}`, r.status === 'AS' && r.currentDisplay === 'AS thru 7' && r.leader === null && r.lead === 0);
  });

  it('MPF.6: DORMIE (lead === holesRemaining > 0)', () => {
    // 14 holes played, 4 remaining; A up by 4 → DORMIE
    const r = formatMatchState(7, 3, 14, 18);
    record('MPF.6', 'DORMIE: lead==remaining==4', '"DORMIE"/"DORMIE"', `${r.status}/${r.currentDisplay}`, r.status === 'DORMIE' && r.currentDisplay === 'DORMIE' && r.isComplete === false);
  });

  it('MPF.7: DORMIE perspective=B → still DORMIE (no DOWN-flavored DORMIE in Stage 1)', () => {
    const r = formatMatchState(7, 3, 14, 18, 'B');
    record('MPF.7', 'DORMIE from trailing perspective', '"DORMIE"/"DORMIE"', `${r.status}/${r.currentDisplay}`, r.status === 'DORMIE' && r.currentDisplay === 'DORMIE');
  });

  it('MPF.8: lead > remaining at hole 14 → CLINCHED 5&4', () => {
    // 14 played, 4 remaining, A wins 9 / B wins 4 / halved 1 → A up 5, but lead > remaining
    const r = formatMatchState(9, 4, 14, 18);
    record('MPF.8', 'clinched mid-round 5&4', '"CLINCHED"/"5&4"', `${r.status}/${r.finalDisplay}`, r.status === 'CLINCHED' && r.finalDisplay === '5&4' && r.isComplete === true);
  });
});

describe('MATCH PLAY — formatMatchState (end-of-match states)', () => {
  it('MPF.9: All 18 played, halved → FINAL HALVED', () => {
    const r = formatMatchState(7, 7, 18, 18);
    record('MPF.9', 'all-played, even', '"FINAL"/"HALVED"', `${r.status}/${r.finalDisplay}`, r.status === 'FINAL' && r.finalDisplay === 'HALVED' && r.isComplete === true);
  });

  it('MPF.10: Won on the final hole 1 UP', () => {
    const r = formatMatchState(8, 7, 18, 18);
    record('MPF.10', 'all-played, 1 UP on 18', '"FINAL"/"1 UP"', `${r.status}/${r.finalDisplay}`, r.status === 'FINAL' && r.finalDisplay === '1 UP' && r.lead === 1);
  });

  it('MPF.11: Clinched 2&1 (17 played, lead 2)', () => {
    const r = formatMatchState(8, 6, 17, 18);
    record('MPF.11', 'clinched 2&1 on 17', '"CLINCHED"/"2&1"', `${r.status}/${r.finalDisplay}`, r.status === 'CLINCHED' && r.finalDisplay === '2&1');
  });

  it('MPF.12: Clinched 6&5 (13 played, lead 6)', () => {
    const r = formatMatchState(9, 3, 13, 18);
    record('MPF.12', 'big lead clinched early', '"CLINCHED"/"6&5"', `${r.status}/${r.finalDisplay}`, r.status === 'CLINCHED' && r.finalDisplay === '6&5');
  });

  it('MPF.13: 9-hole match — completes at totalHoles=9', () => {
    const r = formatMatchState(5, 3, 9, 9);
    record('MPF.13', '9-hole match final', '"FINAL"/"2 UP"', `${r.status}/${r.finalDisplay}`, r.status === 'FINAL' && r.finalDisplay === '2 UP' && r.isComplete === true);
  });
});

describe('MATCH PLAY — formatMatchState edge cases', () => {
  it('MPF.14: leader correctness for tied state', () => {
    const r = formatMatchState(5, 5, 10, 18);
    record('MPF.14', 'tied → leader null', 'null', String(r.leader), r.leader === null);
  });

  it('MPF.15: holesPlayed > totalHoles defensive (treats as complete)', () => {
    // shouldn't happen in practice but engine should not throw
    const r = formatMatchState(10, 8, 18, 18);
    record('MPF.15', 'all-played edge', '"FINAL"/"2 UP"', `${r.status}/${r.finalDisplay}`, r.status === 'FINAL' && r.finalDisplay === '2 UP');
  });

  it('MPF.16: deriveSinglesSideScore — gross', () => {
    const v = deriveSinglesSideScore(4, 0);
    record('MPF.16', 'gross 4, 0 strokes', '4', String(v), v === 4);
  });

  it('MPF.17: deriveSinglesSideScore — net (1 stroke off gross 5)', () => {
    const v = deriveSinglesSideScore(5, 1);
    record('MPF.17', 'gross 5 minus 1 stroke', '4', String(v), v === 4);
  });

  it('MPF.18: deriveSinglesSideScore — undefined gross → null', () => {
    const v = deriveSinglesSideScore(undefined, 0);
    record('MPF.18', 'no entry yet → null', 'null', String(v), v === null);
  });

  it('MPF.19: deriveSinglesSideScore — default strokes 0 (gross path)', () => {
    const v = deriveSinglesSideScore(6);
    record('MPF.19', 'omitted strokes', '6', String(v), v === 6);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CROSS-FORMAT COMPARISONS
// ═══════════════════════════════════════════════════════════════════════

describe('CROSS-FORMAT COMPARISONS', () => {
  it('Same round: Standard vs Modified Stableford', () => {
    const stdTotal = calculateStablefordFromRound(FRONT_9_SCORES, FRONT_9_PARS); // 16
    const modTotal = calculateModifiedStablefordFromRound(FRONT_9_SCORES, FRONT_9_PARS); // -1
    record('X.1', 'Front 9: standard vs modified', `Std: 16, Mod: -1`, `Std: ${stdTotal}, Mod: ${modTotal}`, stdTotal === 16 && modTotal === -1);
    expect(stdTotal).toBe(16);
    expect(modTotal).toBe(-1);
  });

  it('Same round: Gross vs Net stroke play', () => {
    const gross = FRONT_9_SCORES.reduce((a, b) => a + b, 0); // 38
    const net = calculateNetScore(gross, 6); // 38 - 6 = 32
    record('X.2', 'Front 9 gross=38, HCP 6', `Gross: 38, Net: 32`, `Gross: ${gross}, Net: ${net}`, gross === 38 && net === 32);
    expect(gross).toBe(38);
    expect(net).toBe(32);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DORMIE MOMENTS — isMatchPlay GATE (regression: match-close fired on
// non-match rounds, e.g. Stableford). Gate must suppress DORMIE/MATCH_CLOSED
// when !isMatchPlay, but never touch the unconditional SKINS_JACKPOT path.
// ═══════════════════════════════════════════════════════════════════════

describe('DORMIE MOMENTS: isMatchPlay gate', () => {
  const HOLES_9 = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => makeHole(n, 4));

  // Through hole 6 (3 remaining): A wins holes 1–5, hole 6 halved → lead 5 > 3 → MATCH_CLOSED.
  const matchClosedScores = makeAllScores([
    ...[1, 2, 3, 4, 5].flatMap((h) => [
      { hole: h, playerId: '1', score: makeScore(3, 2, null) },
      { hole: h, playerId: '2', score: makeScore(5, 2, null) },
    ]),
    { hole: 6, playerId: '1', score: makeScore(4, 2, null) },
    { hole: 6, playerId: '2', score: makeScore(4, 2, null) },
  ]);

  // Through hole 6 (3 remaining): A wins holes 1–3, holes 4–6 halved → lead 3 === 3 → DORMIE.
  const dormieScores = makeAllScores([
    ...[1, 2, 3].flatMap((h) => [
      { hole: h, playerId: '1', score: makeScore(3, 2, null) },
      { hole: h, playerId: '2', score: makeScore(5, 2, null) },
    ]),
    ...[4, 5, 6].flatMap((h) => [
      { hole: h, playerId: '1', score: makeScore(4, 2, null) },
      { hole: h, playerId: '2', score: makeScore(4, 2, null) },
    ]),
  ]);

  // Through hole 4 (5 remaining): holes 1–3 halved (skin carries x3), hole 4 won by A →
  // SKINS_JACKPOT. Match lead is only 1 (< 5), so no match moment regardless of the flag.
  const skinsScores = makeAllScores([
    ...[1, 2, 3].flatMap((h) => [
      { hole: h, playerId: '1', score: makeScore(4, 2, null) },
      { hole: h, playerId: '2', score: makeScore(4, 2, null) },
    ]),
    { hole: 4, playerId: '1', score: makeScore(3, 2, null) },
    { hole: 4, playerId: '2', score: makeScore(4, 2, null) },
  ]);

  const PLAYERS = [
    { id: '1', name: 'You' },
    { id: '2', name: 'Rival' },
  ] as any;

  it('DMG.1: MATCH_CLOSED board returns null when isMatchPlay=false (the regression fix)', () => {
    const r = checkDormieMoments(6, matchClosedScores, PLAYERS, HOLES_9, [], false);
    record('DMG.1', 'match-close board, !isMatchPlay', 'null', JSON.stringify(r), r === null);
    expect(r).toBe(null);
  });

  it('DMG.2: MATCH_CLOSED board returns MATCH_CLOSED when isMatchPlay=true (real positive intact)', () => {
    const r = checkDormieMoments(6, matchClosedScores, PLAYERS, HOLES_9, [], true);
    record('DMG.2', 'match-close board, isMatchPlay', 'MATCH_CLOSED', String(r?.type), r?.type === 'MATCH_CLOSED');
    expect(r?.type).toBe('MATCH_CLOSED');
  });

  it('DMG.3: DORMIE board returns null when isMatchPlay=false', () => {
    const r = checkDormieMoments(6, dormieScores, PLAYERS, HOLES_9, [], false);
    record('DMG.3', 'dormie board, !isMatchPlay', 'null', JSON.stringify(r), r === null);
    expect(r).toBe(null);
  });

  it('DMG.4: DORMIE board returns DORMIE when isMatchPlay=true', () => {
    const r = checkDormieMoments(6, dormieScores, PLAYERS, HOLES_9, [], true);
    record('DMG.4', 'dormie board, isMatchPlay', 'DORMIE', String(r?.type), r?.type === 'DORMIE');
    expect(r?.type).toBe('DORMIE');
  });

  it('DMG.5: SKINS_JACKPOT still fires when isMatchPlay=false (skins path unaffected by gate)', () => {
    const r = checkDormieMoments(4, skinsScores, PLAYERS, HOLES_9, ['skins'], false);
    record('DMG.5', 'skins board, !isMatchPlay', 'SKINS_JACKPOT', String(r?.type), r?.type === 'SKINS_JACKPOT');
    expect(r?.type).toBe('SKINS_JACKPOT');
  });

  it('DMG.6: SKINS_JACKPOT also fires when isMatchPlay=true (flag does not disturb skins)', () => {
    const r = checkDormieMoments(4, skinsScores, PLAYERS, HOLES_9, ['skins'], true);
    record('DMG.6', 'skins board, isMatchPlay', 'SKINS_JACKPOT', String(r?.type), r?.type === 'SKINS_JACKPOT');
    expect(r?.type).toBe('SKINS_JACKPOT');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// MATCH PLAY POST-ROUND — resolveMatchResult CLINCH FREEZE (Stage 3b)
// The regression that motivated this stage: the engine's finalDisplay drifts
// when scores are entered past the close-out. These tests pin the frozen
// result — clinched 3&2 on 16 must stay "3&2" no matter what holes 17-18 do.
// ═══════════════════════════════════════════════════════════════════════

describe('MATCH PLAY POST-ROUND: resolveMatchResult clinch freeze', () => {
  const HOLES_18 = Array.from({ length: 18 }, (_, i) => makeHole(i + 1, 4));
  const NO_HCP = new Map<string, Map<number, number>>();

  // Base board: A (id '1') wins holes 1-3, holes 4-16 halved → dormie 3-up
  // after 15, closes out 3&2 on hole 16. `extra` appends holes 17-18.
  const buildBoard = (extra: Array<{ hole: number; a: number; b: number }>) => {
    const rows: Array<{ hole: number; playerId: string; score: HoleScore }> = [];
    for (const h of [1, 2, 3]) {
      rows.push({ hole: h, playerId: '1', score: makeScore(3, 2, null) });
      rows.push({ hole: h, playerId: '2', score: makeScore(5, 2, null) });
    }
    for (let h = 4; h <= 16; h++) {
      rows.push({ hole: h, playerId: '1', score: makeScore(4, 2, null) });
      rows.push({ hole: h, playerId: '2', score: makeScore(4, 2, null) });
    }
    for (const e of extra) {
      rows.push({ hole: e.hole, playerId: '1', score: makeScore(e.a, 2, null) });
      rows.push({ hole: e.hole, playerId: '2', score: makeScore(e.b, 2, null) });
    }
    return makeAllScores(rows);
  };

  it('RMR.1: clinched 3&2 on 16, holes 17-18 SPLIT → still 3&2', () => {
    // 17: A wins, 18: B wins. Engine would net to lead 3 still, but we must not depend on that.
    const r = resolveMatchResult('1', '2', HOLES_18, buildBoard([{ hole: 17, a: 3, b: 5 }, { hole: 18, a: 5, b: 3 }]), 'gross', NO_HCP);
    record('RMR.1', 'clinch16, 17-18 split', 'A/3&2/hole16', `${r.leader}/${r.display}/hole${r.clinchHole}`, r.leader === 'A' && r.display === '3&2' && r.clinchHole === 16);
    expect(r.display).toBe('3&2');
    expect(r.leader).toBe('A');
    expect(r.clinchHole).toBe(16);
  });

  it('RMR.2: clinched 3&2 on 16, holes 17-18 both HALVED → still 3&2', () => {
    const r = resolveMatchResult('1', '2', HOLES_18, buildBoard([{ hole: 17, a: 4, b: 4 }, { hole: 18, a: 4, b: 4 }]), 'gross', NO_HCP);
    record('RMR.2', 'clinch16, 17-18 halved', 'A/3&2', `${r.leader}/${r.display}`, r.leader === 'A' && r.display === '3&2');
    expect(r.display).toBe('3&2');
  });

  it('RMR.3: clinched 3&2 on 16, TRAILER wins 17 AND 18 → still 3&2 (the drift bug)', () => {
    // This is the exact case that made the engine emit "1 UP". Helper must freeze 3&2.
    const r = resolveMatchResult('1', '2', HOLES_18, buildBoard([{ hole: 17, a: 5, b: 3 }, { hole: 18, a: 5, b: 3 }]), 'gross', NO_HCP);
    record('RMR.3', 'clinch16, trailer wins 17+18', 'A/3&2/early', `${r.leader}/${r.display}/${r.clinchedEarly}`, r.leader === 'A' && r.display === '3&2' && r.clinchedEarly === true);
    expect(r.display).toBe('3&2');
    expect(r.clinchedEarly).toBe(true);
  });

  it('RMR.4: clinched 3&2 on 16, NO holes 17-18 entered → 3&2 (freeze independent of trailing holes)', () => {
    const r = resolveMatchResult('1', '2', HOLES_18, buildBoard([]), 'gross', NO_HCP);
    record('RMR.4', 'clinch16, 17-18 blank', 'A/3&2/hole16', `${r.leader}/${r.display}/hole${r.clinchHole}`, r.leader === 'A' && r.display === '3&2' && r.clinchHole === 16);
    expect(r.display).toBe('3&2');
    expect(r.clinchHole).toBe(16);
  });

  it('RMR.5: won on the final hole → "1 UP" (not "1&0"), clinchedEarly false', () => {
    // Holes 1-17 halved, A wins 18. No early close-out; decided on the last hole.
    const rows: Array<{ hole: number; playerId: string; score: HoleScore }> = [];
    for (let h = 1; h <= 17; h++) {
      rows.push({ hole: h, playerId: '1', score: makeScore(4, 2, null) });
      rows.push({ hole: h, playerId: '2', score: makeScore(4, 2, null) });
    }
    rows.push({ hole: 18, playerId: '1', score: makeScore(3, 2, null) });
    rows.push({ hole: 18, playerId: '2', score: makeScore(5, 2, null) });
    const r = resolveMatchResult('1', '2', HOLES_18, makeAllScores(rows), 'gross', NO_HCP);
    record('RMR.5', 'won on 18', 'A/1 UP/notearly/nullhole', `${r.leader}/${r.display}/${r.clinchedEarly}/${r.clinchHole}`, r.leader === 'A' && r.display === '1 UP' && r.clinchedEarly === false && r.clinchHole === null);
    expect(r.display).toBe('1 UP');
    expect(r.clinchedEarly).toBe(false);
    expect(r.clinchHole).toBe(null);
  });

  it('RMR.6: all square through 18 → "HALVED", leader null', () => {
    const rows: Array<{ hole: number; playerId: string; score: HoleScore }> = [];
    for (let h = 1; h <= 18; h++) {
      rows.push({ hole: h, playerId: '1', score: makeScore(4, 2, null) });
      rows.push({ hole: h, playerId: '2', score: makeScore(4, 2, null) });
    }
    const r = resolveMatchResult('1', '2', HOLES_18, makeAllScores(rows), 'gross', NO_HCP);
    record('RMR.6', 'AS through 18', 'null/HALVED', `${r.leader}/${r.display}`, r.leader === null && r.display === 'HALVED');
    expect(r.display).toBe('HALVED');
    expect(r.leader).toBe(null);
  });

  it('RMR.7: NET mode — strokes flip holes 1-3 to A, clinch 3&2 on 16 (gross would be all square)', () => {
    // Gross: holes 1-3 are 5-5 (halved) → match would be AS. With A getting a
    // stroke on 1,2,3, net A=4 wins each → same 3&2 clinch. Proves scoreMode path.
    const rows: Array<{ hole: number; playerId: string; score: HoleScore }> = [];
    for (const h of [1, 2, 3]) {
      rows.push({ hole: h, playerId: '1', score: makeScore(5, 2, null) });
      rows.push({ hole: h, playerId: '2', score: makeScore(5, 2, null) });
    }
    for (let h = 4; h <= 16; h++) {
      rows.push({ hole: h, playerId: '1', score: makeScore(4, 2, null) });
      rows.push({ hole: h, playerId: '2', score: makeScore(4, 2, null) });
    }
    const board = makeAllScores(rows);
    const hcp = new Map<string, Map<number, number>>([['1', new Map([[1, 1], [2, 1], [3, 1]])]]);
    const net = resolveMatchResult('1', '2', HOLES_18, board, 'net', hcp);
    const gross = resolveMatchResult('1', '2', HOLES_18, board, 'gross', hcp);
    record('RMR.7', 'net flips 1-3 → 3&2; gross HALVED', 'net=3&2,gross=HALVED', `net=${net.display},gross=${gross.display}`, net.display === '3&2' && net.leader === 'A' && gross.display === 'HALVED');
    expect(net.display).toBe('3&2');
    expect(gross.display).toBe('HALVED');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// STABLEFORD LIVE — computeStablefordLive (live in-round points, Stage 1)
// Points scale (net diff from par): +2+ → 0, +1 → 1, par → 2, birdie → 3,
// eagle → 4, ≤ -3 → 5. thru = holes scored. Individual format, any count.
// ═══════════════════════════════════════════════════════════════════════

describe('STABLEFORD LIVE: computeStablefordLive', () => {
  const HOLES_4 = [1, 2, 3, 4].map((n) => makeHole(n, 4));
  const NO_HCP = new Map<string, Map<number, number>>();

  // Known par-4 board for player '1': par(2) + birdie(3) + bogey(1) + double(0) = 6.
  const grossBoard = makeAllScores([
    { hole: 1, playerId: '1', score: makeScore(4, 2, null) }, // par → 2
    { hole: 2, playerId: '1', score: makeScore(3, 2, null) }, // birdie → 3
    { hole: 3, playerId: '1', score: makeScore(5, 2, null) }, // bogey → 1
    { hole: 4, playerId: '1', score: makeScore(6, 2, null) }, // double → 0
  ]);

  it('SL.1: gross round — points + thru correct across a known board', () => {
    const m = computeStablefordLive(HOLES_4, grossBoard, NO_HCP, 'gross');
    const e = m.get('1');
    record('SL.1', 'par+birdie+bogey+double', '6/4', `${e?.points}/${e?.thru}`, e?.points === 6 && e?.thru === 4);
    expect(e?.points).toBe(6);
    expect(e?.thru).toBe(4);
  });

  it('SL.2: net round — handicap strokes change points (same board diverges from gross)', () => {
    // 1 stroke on holes 3 & 4: bogey→par (1→2), double→bogey (0→1). Net 8 vs gross 6.
    const hcp = new Map<string, Map<number, number>>([['1', new Map([[3, 1], [4, 1]])]]);
    const net = computeStablefordLive(HOLES_4, grossBoard, hcp, 'net');
    const gross = computeStablefordLive(HOLES_4, grossBoard, hcp, 'gross');
    record('SL.2', 'net strokes on 3,4', 'net=8,gross=6', `net=${net.get('1')?.points},gross=${gross.get('1')?.points}`, net.get('1')?.points === 8 && gross.get('1')?.points === 6);
    expect(net.get('1')?.points).toBe(8);
    expect(gross.get('1')?.points).toBe(6);
  });

  it('SL.3: partial round — unscored holes contribute 0 and do not count toward thru', () => {
    // Only holes 1-2 entered: par(2) + birdie(3) = 5, thru 2.
    const partial = makeAllScores([
      { hole: 1, playerId: '1', score: makeScore(4, 2, null) },
      { hole: 2, playerId: '1', score: makeScore(3, 2, null) },
    ]);
    const e = computeStablefordLive(HOLES_4, partial, NO_HCP, 'gross').get('1');
    record('SL.3', 'thru 2 of 4', '5/2', `${e?.points}/${e?.thru}`, e?.points === 5 && e?.thru === 2);
    expect(e?.points).toBe(5);
    expect(e?.thru).toBe(2);
  });

  it('SL.4: 3-player board — no player-count assumption, each tallied independently', () => {
    const three = makeAllScores([
      { hole: 1, playerId: '1', score: makeScore(4, 2, null) }, { hole: 2, playerId: '1', score: makeScore(4, 2, null) }, // 2+2=4
      { hole: 1, playerId: '2', score: makeScore(3, 2, null) }, { hole: 2, playerId: '2', score: makeScore(3, 2, null) }, // 3+3=6
      { hole: 1, playerId: '3', score: makeScore(5, 2, null) }, { hole: 2, playerId: '3', score: makeScore(5, 2, null) }, // 1+1=2
    ]);
    const m = computeStablefordLive(HOLES_4, three, NO_HCP, 'gross');
    const ok = m.size === 3 && m.get('1')?.points === 4 && m.get('2')?.points === 6 && m.get('3')?.points === 2;
    record('SL.4', '3 players, 2 holes each', '4/6/2,size3', `${m.get('1')?.points}/${m.get('2')?.points}/${m.get('3')?.points},size${m.size}`, ok);
    expect(ok).toBe(true);
  });

  it('SL.5: empty board → empty map (no players, no points)', () => {
    const m = computeStablefordLive(HOLES_4, makeAllScores([]), NO_HCP, 'gross');
    record('SL.5', 'no scores entered', 'size 0', `size ${m.size}`, m.size === 0);
    expect(m.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// STABLEFORD LIVE LEADERBOARD — rankStablefordLive (Stage 3 ranking)
// Contract: points DESC; unscored (thru===0, NOT points===0) pinned last in
// roster order; ties break by roster index (deliberately not thru — a
// 0-point hole must not reorder tied players).
// ═══════════════════════════════════════════════════════════════════════

describe('STABLEFORD LIVE LEADERBOARD: rankStablefordLive', () => {
  const entry = (points: number, thru: number) => ({ points, thru });

  it('RSL.1: points DESC — higher points rank first regardless of roster order', () => {
    const ranked = rankStablefordLive(
      ['1', '2', '3'],
      new Map([['1', entry(4, 3)], ['2', entry(9, 3)], ['3', entry(6, 3)]]),
    );
    const order = ranked.map((r) => r.playerId).join(',');
    record('RSL.1', 'pts 4/9/6 by roster', '2,3,1', order, order === '2,3,1');
    expect(order).toBe('2,3,1');
  });

  it('RSL.2: earned zero (thru>0) ranks ABOVE unscored (thru===0); unscored last in roster order', () => {
    const ranked = rankStablefordLive(
      ['1', '2', '3', '4'],
      new Map([['2', entry(0, 4)], ['3', entry(5, 4)]]), // 1 & 4 never teed off
    );
    const order = ranked.map((r) => r.playerId).join(',');
    const bottom = ranked[2];
    record('RSL.2', 'earned-0 vs unscored', '3,2,1,4', order, order === '3,2,1,4' && bottom.points === 0 && bottom.thru === 0);
    expect(order).toBe('3,2,1,4');
    expect(ranked[3]).toEqual({ playerId: '4', points: 0, thru: 0 });
  });

  it('RSL.3: tie holds roster order and does NOT reorder on a 0-point hole (thru change, points unchanged)', () => {
    // Before: 1 and 3 tied at 7, both thru 4. After: player 3 blobs hole 5
    // (thru 5, still 7 points). Order must be identical both times.
    const before = rankStablefordLive(
      ['1', '2', '3'],
      new Map([['1', entry(7, 4)], ['2', entry(3, 4)], ['3', entry(7, 4)]]),
    ).map((r) => r.playerId).join(',');
    const after = rankStablefordLive(
      ['1', '2', '3'],
      new Map([['1', entry(7, 4)], ['2', entry(3, 4)], ['3', entry(7, 5)]]),
    ).map((r) => r.playerId).join(',');
    record('RSL.3', 'tie stable across blob hole', `${before}==${after}`, `${before}/${after}`, before === '1,3,2' && after === '1,3,2');
    expect(before).toBe('1,3,2');
    expect(after).toBe('1,3,2');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════

console.log('\n========================================');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('========================================');

if (failures.length > 0) {
  console.log('\n  Failures:');
  failures.forEach((f) => console.log(f));
}

// Print recorded results table
console.log('\n  Recorded Results:');
console.log('  ' + '-'.repeat(100));
console.log('  ' + 'Step'.padEnd(8) + 'Pass'.padEnd(6) + 'Expected'.padEnd(40) + 'Actual'.padEnd(40));
console.log('  ' + '-'.repeat(100));
for (const r of results) {
  console.log('  ' + r.step.padEnd(8) + (r.pass ? 'PASS' : 'FAIL').padEnd(6) + r.expected.padEnd(40) + r.actual.padEnd(40));
}

process.exit(failed > 0 ? 1 : 0);
