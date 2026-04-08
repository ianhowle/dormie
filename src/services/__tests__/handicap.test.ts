/**
 * Handicap Service Tests — WHS Rule Compliance
 *
 * Tests all pure calculation functions from handicap.service.ts.
 * These tests verify correctness of the World Handicap System implementation.
 *
 * Run with: npx jest src/services/__tests__/handicap.test.ts
 * Or standalone: npx ts-node src/services/__tests__/handicap.test.ts
 */

import {
  calculateScoreDifferential,
  applyNetDoubleBogeyAdjustment,
  selectDifferentials,
  calculateHandicapIndex,
  calculateCourseHandicap,
  calculateNetScore,
  calculateIntegrity,
} from '../handicap.service';

// ─── Test Runner (works without jest if needed) ─────────────────────────

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

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected: any) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(`Expected ${b}, got ${a}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (!(actual >= expected)) {
        throw new Error(`Expected ${actual} >= ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected: number) {
      if (!(actual <= expected)) {
        throw new Error(`Expected ${actual} <= ${expected}`);
      }
    },
    toBeCloseTo(expected: number, precision: number = 2) {
      const diff = Math.abs(actual - expected);
      const tolerance = Math.pow(10, -precision) / 2;
      if (diff > tolerance) {
        throw new Error(`Expected ${actual} to be close to ${expected} (diff: ${diff})`);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateScoreDifferential', () => {
  it('calculates basic differential correctly', () => {
    // Score 85, Rating 72.0, Slope 130
    // (113 / 130) * (85 - 72.0) = 0.8692 * 13 = 11.3
    const result = calculateScoreDifferential(85, 72.0, 130);
    expect(result).toBe(11.3);
  });

  it('truncates to 1 decimal (not rounds)', () => {
    // Score 90, Rating 71.5, Slope 128
    // (113 / 128) * (90 - 71.5) = 0.8828125 * 18.5 = 16.332...
    const result = calculateScoreDifferential(90, 71.5, 128);
    expect(result).toBe(16.3);
  });

  it('handles PCC adjustment', () => {
    // Score 85, Rating 72.0, Slope 130, PCC +1
    // (113 / 130) * (85 - 72.0 - 1) = 0.8692 * 12 = 10.4307...
    const result = calculateScoreDifferential(85, 72.0, 130, 1);
    expect(result).toBe(10.4);
  });

  it('returns negative differential for under-rating score', () => {
    // Score 70, Rating 72.0, Slope 113
    // (113 / 113) * (70 - 72.0) = -2.0
    const result = calculateScoreDifferential(70, 72.0, 113);
    expect(result).toBe(-2.0);
  });

  it('uses standard slope 113 correctly', () => {
    // Score 82, Rating 72.0, Slope 113
    // (113 / 113) * (82 - 72.0) = 10.0
    const result = calculateScoreDifferential(82, 72.0, 113);
    expect(result).toBe(10.0);
  });
});

describe('applyNetDoubleBogeyAdjustment', () => {
  // Standard 18-hole setup
  const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
  const strokeIndexes = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 2, 16, 6, 4, 12, 18, 10, 14];

  it('caps hole score at par + 2 + strokes received', () => {
    // Course handicap = 5: player gets 1 stroke on SI 1-5
    // Hole 4 (SI 1): par 5 + 2 + 1 stroke = max 8
    // Actual score 9 on hole 4 → capped to 8
    const scores = [4, 4, 3, 9, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 5, strokeIndexes);
    // Hole 4 capped: 9 → 8, all others at or below max
    const expectedTotal = scores.reduce((a, b) => a + b, 0) - 1; // 9→8 saves 1
    expect(result).toBe(expectedTotal);
  });

  it('hole score 9 on par 4 with 1 handicap stroke → capped at 7', () => {
    // Course handicap = 18: 1 stroke per hole
    // Par 4 + 2 + 1 = 7 max
    // Score 9 → capped to 7
    const scores = [9, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 18, strokeIndexes);
    // Hole 1 (SI 7): par 4 + 2 + 1 = 7, score 9 → 7 (save 2)
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    expect(result).toBe(rawTotal - 2);
  });

  it('does not cap scores already below max', () => {
    // All scores are bogey or better — no capping needed
    const scores = [5, 5, 4, 6, 5, 5, 4, 5, 6, 5, 6, 4, 5, 5, 5, 4, 6, 5];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 18, strokeIndexes);
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    expect(result).toBe(rawTotal); // No capping
  });

  it('handles courseHandicap > 18 (double strokes on hardest holes)', () => {
    // Course handicap = 20: 1 stroke on all 18 + extra stroke on SI 1 and SI 2
    // Hole 4 (SI 1): par 5 + 2 + 2 = 9 max
    // Hole 11 (SI 2): par 5 + 2 + 2 = 9 max
    // Hole 1 (SI 7): par 4 + 2 + 1 = 7 max
    const scores = [10, 4, 3, 11, 4, 4, 3, 4, 5, 4, 11, 3, 4, 4, 4, 3, 5, 4];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 20, strokeIndexes);
    // Hole 1 (SI 7): 10 → 7 (save 3)
    // Hole 4 (SI 1): 11 → 9 (save 2)
    // Hole 11 (SI 2): 11 → 9 (save 2)
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    expect(result).toBe(rawTotal - 3 - 2 - 2);
  });

  it('handles courseHandicap = 0 (scratch golfer)', () => {
    // No strokes: max = par + 2
    // Par 4 hole: max = 6
    const scores = [8, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 0, strokeIndexes);
    // Hole 1: par 4 + 2 + 0 = 6 max, score 8 → 6 (save 2)
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    expect(result).toBe(rawTotal - 2);
  });
});

describe('selectDifferentials', () => {
  it('returns empty for fewer than 3 rounds', () => {
    const result = selectDifferentials([10.0, 12.0]);
    expect(result.count).toBe(0);
    expect(result.selectedDifferentials).toEqual([]);
  });

  it('3 rounds → lowest 1, subtract 2.0', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0]); // sorted by date
    expect(result.count).toBe(1);
    expect(result.adjustment).toBe(2.0);
    expect(result.selectedDifferentials).toEqual([10.0]); // lowest
  });

  it('4 rounds → lowest 1, subtract 1.0', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0, 18.0]);
    expect(result.count).toBe(1);
    expect(result.adjustment).toBe(1.0);
    expect(result.selectedDifferentials).toEqual([10.0]);
  });

  it('5 rounds → lowest 1, no adjustment', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0, 18.0, 14.0]);
    expect(result.count).toBe(1);
    expect(result.adjustment).toBe(0);
    expect(result.selectedDifferentials).toEqual([10.0]);
  });

  it('6 rounds → lowest 2, subtract 1.0', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0, 18.0, 14.0, 11.0]);
    expect(result.count).toBe(2);
    expect(result.adjustment).toBe(1.0);
    expect(result.selectedDifferentials).toEqual([10.0, 11.0]);
  });

  it('8 rounds → lowest 2, no adjustment', () => {
    const diffs = [15.0, 10.0, 12.0, 18.0, 14.0, 11.0, 16.0, 13.0];
    const result = selectDifferentials(diffs);
    expect(result.count).toBe(2);
    expect(result.adjustment).toBe(0);
    expect(result.selectedDifferentials).toEqual([10.0, 11.0]);
  });

  it('11 rounds → lowest 3', () => {
    const diffs = Array.from({ length: 11 }, (_, i) => 10.0 + i);
    const result = selectDifferentials(diffs);
    expect(result.count).toBe(3);
    expect(result.adjustment).toBe(0);
    expect(result.selectedDifferentials).toEqual([10.0, 11.0, 12.0]);
  });

  it('14 rounds → lowest 4', () => {
    const diffs = Array.from({ length: 14 }, (_, i) => 10.0 + i);
    const result = selectDifferentials(diffs);
    expect(result.count).toBe(4);
    expect(result.adjustment).toBe(0);
  });

  it('16 rounds → lowest 5', () => {
    const diffs = Array.from({ length: 16 }, (_, i) => 10.0 + i);
    const result = selectDifferentials(diffs);
    expect(result.count).toBe(5);
    expect(result.adjustment).toBe(0);
  });

  it('18 rounds → lowest 6', () => {
    const diffs = Array.from({ length: 18 }, (_, i) => 10.0 + i);
    const result = selectDifferentials(diffs);
    expect(result.count).toBe(6);
    expect(result.adjustment).toBe(0);
  });

  it('19 rounds → lowest 7', () => {
    const diffs = Array.from({ length: 19 }, (_, i) => 10.0 + i);
    const result = selectDifferentials(diffs);
    expect(result.count).toBe(7);
    expect(result.adjustment).toBe(0);
  });

  it('20 rounds → lowest 8', () => {
    const diffs = Array.from({ length: 20 }, (_, i) => 10.0 + i);
    const result = selectDifferentials(diffs);
    expect(result.count).toBe(8);
    expect(result.adjustment).toBe(0);
    expect(result.selectedDifferentials).toEqual([10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0]);
  });

  it('takes only the 20 most recent when given > 20', () => {
    const diffs = Array.from({ length: 25 }, (_, i) => 5.0 + i); // 5..29
    const result = selectDifferentials(diffs);
    // Only first 20 (5..24) considered; lowest 8 of those
    expect(result.count).toBe(8);
    expect(result.selectedDifferentials).toEqual([5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0]);
  });
});

describe('calculateHandicapIndex', () => {
  it('calculates basic index from selected differentials', () => {
    const selected = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0];
    const result = calculateHandicapIndex(selected, 0);
    // Average = 13.5, no adjustment, no caps
    expect(result).toBe(13.5);
  });

  it('applies adjustment correctly', () => {
    const result = calculateHandicapIndex([10.0], 2.0);
    // 10.0 - 2.0 = 8.0
    expect(result).toBe(8.0);
  });

  it('truncates to 1 decimal (not rounds): 14.58 → 14.5', () => {
    // Need avg - adj = 14.58...
    // Two diffs: 14.5 and 14.67 → avg = 14.585
    const result = calculateHandicapIndex([14.5, 14.67], 0);
    // avg = 14.585, truncated = 14.5
    expect(result).toBe(14.5);
  });

  it('applies soft cap: 50% of excess above low + 3.0', () => {
    // Low handicap index = 10.0
    // Calculated raw = 15.0 (5.0 above low)
    // Soft cap threshold = 13.0
    // 15.0 > 13.0: excess = 2.0, 50% = 1.0
    // Result = 13.0 + 1.0 = 14.0
    const result = calculateHandicapIndex([15.0], 0, 10.0);
    expect(result).toBe(14.0);
  });

  it('applies hard cap: cannot exceed low + 5.0', () => {
    // Low handicap index = 10.0
    // Calculated raw = 20.0 (10.0 above low)
    // Soft cap: 13.0 + (20.0 - 13.0) * 0.5 = 13.0 + 3.5 = 16.5
    // Hard cap: 15.0
    // Result = 15.0
    const result = calculateHandicapIndex([20.0], 0, 10.0);
    expect(result).toBe(15.0);
  });

  it('caps at maximum 54.0', () => {
    const result = calculateHandicapIndex([60.0], 0);
    expect(result).toBe(54.0);
  });

  it('allows negative handicap index (scratch/plus)', () => {
    const result = calculateHandicapIndex([-2.5], 0);
    expect(result).toBe(-2.5);
  });

  it('3-round scenario: lowest 1, minus 2.0', () => {
    const diffs = [12.0, 8.0, 15.0]; // Date-ordered
    const selection = selectDifferentials(diffs);
    const index = calculateHandicapIndex(
      selection.selectedDifferentials,
      selection.adjustment,
    );
    // Lowest = 8.0, subtract 2.0 = 6.0
    expect(index).toBe(6.0);
  });

  it('5-round scenario: lowest 1, no adjustment', () => {
    const diffs = [12.0, 8.0, 15.0, 10.0, 14.0];
    const selection = selectDifferentials(diffs);
    const index = calculateHandicapIndex(
      selection.selectedDifferentials,
      selection.adjustment,
    );
    // Lowest = 8.0, no adjustment
    expect(index).toBe(8.0);
  });

  it('8-round scenario: lowest 2, no adjustment', () => {
    const diffs = [15.0, 8.0, 12.0, 18.0, 14.0, 9.0, 16.0, 13.0];
    const selection = selectDifferentials(diffs);
    const index = calculateHandicapIndex(
      selection.selectedDifferentials,
      selection.adjustment,
    );
    // Lowest 2 = [8.0, 9.0], avg = 8.5
    expect(index).toBe(8.5);
  });

  it('20-round scenario: lowest 8 of 20', () => {
    // Differentials 5.0 through 24.0
    const diffs = Array.from({ length: 20 }, (_, i) => 5.0 + i);
    const selection = selectDifferentials(diffs);
    const index = calculateHandicapIndex(
      selection.selectedDifferentials,
      selection.adjustment,
    );
    // Lowest 8: 5.0..12.0, avg = 8.5
    expect(index).toBe(8.5);
  });
});

describe('calculateCourseHandicap', () => {
  it('calculates course handicap from known USGA example', () => {
    // USGA example: index 10.5, slope 125, rating 71.2, par 72
    // 10.5 * (125 / 113) + (71.2 - 72) = 10.5 * 1.10619... + (-0.8)
    // = 11.615... - 0.8 = 10.815... → rounds to 11
    const result = calculateCourseHandicap(10.5, 125, 71.2, 72);
    expect(result).toBe(11);
  });

  it('handles standard slope (113) with matching rating/par', () => {
    // Index 15.0, Slope 113, Rating 72.0, Par 72
    // 15.0 * (113/113) + (72.0 - 72) = 15.0
    const result = calculateCourseHandicap(15.0, 113, 72.0, 72);
    expect(result).toBe(15);
  });

  it('adjusts for course rating above par', () => {
    // Index 10.0, Slope 130, Rating 74.0, Par 72
    // 10.0 * (130/113) + (74.0 - 72) = 11.504... + 2.0 = 13.504... → 14
    const result = calculateCourseHandicap(10.0, 130, 74.0, 72);
    expect(result).toBe(14);
  });

  it('adjusts for course rating below par', () => {
    // Index 10.0, Slope 110, Rating 70.0, Par 72
    // 10.0 * (110/113) + (70.0 - 72) = 9.734... - 2.0 = 7.734... → 8
    const result = calculateCourseHandicap(10.0, 110, 70.0, 72);
    expect(result).toBe(8);
  });

  it('handles zero handicap index', () => {
    const result = calculateCourseHandicap(0, 125, 71.2, 72);
    // 0 * (125/113) + (71.2 - 72) = -0.8 → -1
    expect(result).toBe(-1);
  });

  it('handles plus handicap (negative index)', () => {
    const result = calculateCourseHandicap(-2.0, 130, 73.0, 72);
    // -2.0 * (130/113) + (73.0 - 72) = -2.3 + 1.0 = -1.3 → -1
    expect(result).toBe(-1);
  });
});

describe('calculateNetScore', () => {
  it('subtracts course handicap from gross', () => {
    expect(calculateNetScore(85, 12)).toBe(73);
  });

  it('handles zero handicap', () => {
    expect(calculateNetScore(72, 0)).toBe(72);
  });

  it('handles plus handicap (negative course handicap)', () => {
    expect(calculateNetScore(70, -2)).toBe(72);
  });
});

describe('calculateIntegrity', () => {
  it('returns CLEAN for consistent player', () => {
    const diffs = Array.from({ length: 20 }, () => ({
      roundId: 'r',
      adjustedGrossScore: 82,
      courseRating: 72,
      slopeRating: 113,
      differential: 10.0,
      playedAt: '2026-03-01',
    }));
    const rounds = Array.from({ length: 20 }, () => ({
      hole_scores: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, gross: 4 })),
      played_at: '2026-03-01',
    }));
    const history = [{ index: 10.0, date: '2025-12-01' }];
    const result = calculateIntegrity(diffs, 10.0, rounds, history);
    expect(result.label).toBe('CLEAN');
    expect(result.scoreVariance).toBe('Low');
    expect(result.roundCompletion).toBe(100);
  });

  it('flags high variance', () => {
    // Create differentials with high variance
    const diffs = Array.from({ length: 20 }, (_, i) => ({
      roundId: 'r',
      adjustedGrossScore: 82,
      courseRating: 72,
      slopeRating: 113,
      differential: i % 2 === 0 ? 5.0 : 25.0, // extreme variance
      playedAt: '2026-03-01',
    }));
    const rounds = Array.from({ length: 20 }, () => ({
      hole_scores: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, gross: 4 })),
      played_at: '2026-03-01',
    }));
    const result = calculateIntegrity(diffs, 10.0, rounds, []);
    expect(result.scoreVariance).toBe('High');
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
