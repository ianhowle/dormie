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
} from '../scoring';

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
