/**
 * Handicap Service Tests — WHS Rule Compliance
 *
 * Tests all pure calculation functions from handicap.service.ts.
 * Run with: node src/services/__tests__/handicap.test.js
 *
 * We inline-require the TS source by compiling it first, or we
 * duplicate the pure functions here for standalone validation.
 */

'use strict';

// ─── Inline Pure Functions (copied from handicap.service.ts for standalone test) ──

function calculateScoreDifferential(adjustedGrossScore, courseRating, slopeRating, pcc = 0) {
  const differential = (113 / slopeRating) * (adjustedGrossScore - courseRating - pcc);
  return Math.floor(differential * 10) / 10;
}

function applyNetDoubleBogeyAdjustment(holeScores, holePars, courseHandicap, holeStrokeIndexes) {
  let adjustedTotal = 0;
  for (let i = 0; i < holeScores.length; i++) {
    const par = holePars[i];
    const strokeIndex = holeStrokeIndexes[i];
    const actualScore = holeScores[i];
    let strokesOnHole = 0;
    if (courseHandicap > 0) {
      if (courseHandicap >= strokeIndex) strokesOnHole++;
      if (courseHandicap >= 18 + strokeIndex) strokesOnHole++;
      if (courseHandicap >= 36 + strokeIndex) strokesOnHole++;
    }
    const maxScore = par + 2 + strokesOnHole;
    adjustedTotal += Math.min(actualScore, maxScore);
  }
  return adjustedTotal;
}

function selectDifferentials(allDifferentials) {
  const recent = allDifferentials.slice(0, 20);
  const n = recent.length;
  if (n < 3) return { selectedDifferentials: [], adjustment: 0, count: 0 };

  let numToSelect, adjustment;
  if (n === 3) { numToSelect = 1; adjustment = 2.0; }
  else if (n === 4) { numToSelect = 1; adjustment = 1.0; }
  else if (n === 5) { numToSelect = 1; adjustment = 0; }
  else if (n === 6) { numToSelect = 2; adjustment = 1.0; }
  else if (n <= 8) { numToSelect = 2; adjustment = 0; }
  else if (n <= 11) { numToSelect = 3; adjustment = 0; }
  else if (n <= 14) { numToSelect = 4; adjustment = 0; }
  else if (n <= 16) { numToSelect = 5; adjustment = 0; }
  else if (n <= 18) { numToSelect = 6; adjustment = 0; }
  else if (n === 19) { numToSelect = 7; adjustment = 0; }
  else { numToSelect = 8; adjustment = 0; }

  const sorted = [...recent].sort((a, b) => a - b);
  const selected = sorted.slice(0, numToSelect);
  return { selectedDifferentials: selected, adjustment, count: numToSelect };
}

function calculateHandicapIndex(selectedDifferentials, adjustment, lowHandicapIndex) {
  if (selectedDifferentials.length === 0) return 0;
  const avg = selectedDifferentials.reduce((sum, d) => sum + d, 0) / selectedDifferentials.length;
  let index = avg - adjustment;

  if (lowHandicapIndex !== undefined && lowHandicapIndex !== null) {
    const softCapThreshold = lowHandicapIndex + 3.0;
    const hardCapLimit = lowHandicapIndex + 5.0;
    if (index > softCapThreshold) {
      index = softCapThreshold + (index - softCapThreshold) * 0.5;
    }
    if (index > hardCapLimit) {
      index = hardCapLimit;
    }
  }

  if (index > 54.0) index = 54.0;
  return Math.floor(index * 10) / 10;
}

function calculateCourseHandicap(handicapIndex, slopeRating, courseRating, par) {
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - par));
}

function calculateNetScore(grossScore, courseHandicap) {
  return grossScore - courseHandicap;
}

function calculateStandardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateIntegrity(differentials, currentIndex, rounds, indexHistory) {
  const diffs = differentials.slice(0, 20).map(d => d.differential);
  const stdev = calculateStandardDeviation(diffs);

  let scoreVariance;
  if (stdev < 3) scoreVariance = 'Low';
  else if (stdev <= 6) scoreVariance = 'Medium';
  else scoreVariance = 'High';

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oldEntry = indexHistory.find(h => new Date(h.date) <= ninetyDaysAgo);
  const oldIndex = oldEntry ? oldEntry.index : currentIndex;
  const indexChange = currentIndex - oldIndex;

  let handicapTrend;
  if (indexChange < -1.0) handicapTrend = 'Improving';
  else if (indexChange > 1.0) handicapTrend = 'Rising';
  else handicapTrend = 'Consistent';

  const totalRounds = rounds.length;
  const completeRounds = rounds.filter(r => {
    if (!r.hole_scores || !Array.isArray(r.hole_scores)) return false;
    return r.hole_scores.length >= 18;
  }).length;
  const roundCompletion = totalRounds > 0 ? Math.round((completeRounds / totalRounds) * 100) : 100;

  let fairPlayScore = 100;
  if (stdev > 6) fairPlayScore -= 15;
  else if (stdev > 4.5) fairPlayScore -= 7;

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthOldEntry = indexHistory.find(h => new Date(h.date) <= thirtyDaysAgo);
  if (monthOldEntry && (monthOldEntry.index - currentIndex) > 3.0) {
    fairPlayScore -= 20;
  }

  const incompleteCount = totalRounds - completeRounds;
  fairPlayScore -= incompleteCount * 5;

  if (diffs.length >= 5) {
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const outliers = diffs.filter(d => d < mean - 2 * stdev).length;
    if (outliers >= 2) fairPlayScore -= 10;
  }

  fairPlayScore = Math.max(0, Math.min(100, fairPlayScore));

  let label;
  if (fairPlayScore >= 90) label = 'CLEAN';
  else if (fairPlayScore >= 70) label = 'REVIEW';
  else label = 'FLAG';

  return { fairPlayScore, label, scoreVariance, handicapTrend, roundCompletion };
}

// ─── Test Runner ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function describe(name, fn) {
  console.log(`\n  ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    passed++;
    console.log(`    ✓ ${name}`);
  } catch (e) {
    failed++;
    const msg = `    ✗ ${name}: ${e.message}`;
    console.log(msg);
    failures.push(msg);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label = '') {
  if (typeof expected === 'object') {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`${label}Expected ${b}, got ${a}`);
  } else {
    if (actual !== expected) throw new Error(`${label}Expected ${expected}, got ${actual}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateScoreDifferential', () => {
  it('calculates basic differential correctly', () => {
    // Score 85, Rating 72.0, Slope 130
    // (113 / 130) * (85 - 72.0) = 0.86923 * 13 = 11.3
    assertEqual(calculateScoreDifferential(85, 72.0, 130), 11.3);
  });

  it('truncates to 1 decimal (not rounds)', () => {
    // (113 / 128) * (90 - 71.5) = 0.8828125 * 18.5 = 16.332...
    assertEqual(calculateScoreDifferential(90, 71.5, 128), 16.3);
  });

  it('handles PCC adjustment', () => {
    // (113 / 130) * (85 - 72.0 - 1) = 0.86923 * 12 = 10.430...
    assertEqual(calculateScoreDifferential(85, 72.0, 130, 1), 10.4);
  });

  it('returns negative differential for under-rating score', () => {
    assertEqual(calculateScoreDifferential(70, 72.0, 113), -2.0);
  });

  it('uses standard slope 113 correctly', () => {
    assertEqual(calculateScoreDifferential(82, 72.0, 113), 10.0);
  });
});

describe('applyNetDoubleBogeyAdjustment', () => {
  const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
  const strokeIndexes = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 2, 16, 6, 4, 12, 18, 10, 14];

  it('caps hole score at par + 2 + strokes received (CH=5)', () => {
    // CH=5: stroke on SI 1-5 → holes with SI 1,2,3,4,5
    const scores = [4, 4, 3, 9, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 5, strokeIndexes);
    // Hole 4 (SI 1): par 5 + 2 + 1 = 8 max, score 9 ��� 8 (save 1)
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    assertEqual(result, rawTotal - 1);
  });

  it('hole score 9 on par 4 with 1 handicap stroke → capped at 7', () => {
    // CH=18: 1 stroke per hole
    const scores = [9, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 18, strokeIndexes);
    // Hole 1 (SI 7): par 4 + 2 + 1 = 7 max, score 9 → 7 (save 2)
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    assertEqual(result, rawTotal - 2);
  });

  it('does not cap scores already below max', () => {
    const scores = [5, 5, 4, 6, 5, 5, 4, 5, 6, 5, 6, 4, 5, 5, 5, 4, 6, 5];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 18, strokeIndexes);
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    assertEqual(result, rawTotal);
  });

  it('handles courseHandicap > 18 (double strokes on hardest)', () => {
    // CH=20: 2 strokes on SI 1-2, 1 stroke on SI 3-18
    const scores = [10, 4, 3, 11, 4, 4, 3, 4, 5, 4, 11, 3, 4, 4, 4, 3, 5, 4];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 20, strokeIndexes);
    // Hole 1 (SI 7): par 4 + 2 + 1 = 7, score 10 → 7 (save 3)
    // Hole 4 (SI 1): par 5 + 2 + 2 = 9, score 11 → 9 (save 2)
    // Hole 11 (SI 2): par 5 + 2 + 2 = 9, score 11 → 9 (save 2)
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    assertEqual(result, rawTotal - 3 - 2 - 2);
  });

  it('handles courseHandicap = 0 (scratch golfer)', () => {
    const scores = [8, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
    const result = applyNetDoubleBogeyAdjustment(scores, pars, 0, strokeIndexes);
    // Hole 1: par 4 + 2 + 0 = 6, score 8 → 6 (save 2)
    const rawTotal = scores.reduce((a, b) => a + b, 0);
    assertEqual(result, rawTotal - 2);
  });
});

describe('selectDifferentials', () => {
  it('returns empty for fewer than 3 rounds', () => {
    const result = selectDifferentials([10.0, 12.0]);
    assertEqual(result.count, 0);
    assertEqual(result.selectedDifferentials, []);
  });

  it('3 rounds → lowest 1, subtract 2.0', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0]);
    assertEqual(result.count, 1);
    assertEqual(result.adjustment, 2.0);
    assertEqual(result.selectedDifferentials, [10.0]);
  });

  it('4 rounds → lowest 1, subtract 1.0', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0, 18.0]);
    assertEqual(result.count, 1);
    assertEqual(result.adjustment, 1.0);
    assertEqual(result.selectedDifferentials, [10.0]);
  });

  it('5 rounds → lowest 1, no adjustment', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0, 18.0, 14.0]);
    assertEqual(result.count, 1);
    assertEqual(result.adjustment, 0);
    assertEqual(result.selectedDifferentials, [10.0]);
  });

  it('6 rounds → lowest 2, subtract 1.0', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0, 18.0, 14.0, 11.0]);
    assertEqual(result.count, 2);
    assertEqual(result.adjustment, 1.0);
    assertEqual(result.selectedDifferentials, [10.0, 11.0]);
  });

  it('8 rounds → lowest 2, no adjustment', () => {
    const result = selectDifferentials([15.0, 10.0, 12.0, 18.0, 14.0, 11.0, 16.0, 13.0]);
    assertEqual(result.count, 2);
    assertEqual(result.adjustment, 0);
    assertEqual(result.selectedDifferentials, [10.0, 11.0]);
  });

  it('11 rounds → lowest 3', () => {
    const diffs = Array.from({ length: 11 }, (_, i) => 10.0 + i);
    const result = selectDifferentials(diffs);
    assertEqual(result.count, 3);
    assertEqual(result.selectedDifferentials, [10.0, 11.0, 12.0]);
  });

  it('14 rounds → lowest 4', () => {
    const diffs = Array.from({ length: 14 }, (_, i) => 10.0 + i);
    assertEqual(selectDifferentials(diffs).count, 4);
  });

  it('16 rounds → lowest 5', () => {
    const diffs = Array.from({ length: 16 }, (_, i) => 10.0 + i);
    assertEqual(selectDifferentials(diffs).count, 5);
  });

  it('18 rounds → lowest 6', () => {
    const diffs = Array.from({ length: 18 }, (_, i) => 10.0 + i);
    assertEqual(selectDifferentials(diffs).count, 6);
  });

  it('19 rounds → lowest 7', () => {
    const diffs = Array.from({ length: 19 }, (_, i) => 10.0 + i);
    assertEqual(selectDifferentials(diffs).count, 7);
  });

  it('20 rounds → lowest 8', () => {
    const diffs = Array.from({ length: 20 }, (_, i) => 10.0 + i);
    const result = selectDifferentials(diffs);
    assertEqual(result.count, 8);
    assertEqual(result.selectedDifferentials, [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0]);
  });

  it('takes only 20 most recent when given > 20', () => {
    const diffs = Array.from({ length: 25 }, (_, i) => 5.0 + i);
    const result = selectDifferentials(diffs);
    assertEqual(result.count, 8);
    assertEqual(result.selectedDifferentials, [5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0]);
  });
});

describe('calculateHandicapIndex', () => {
  it('calculates basic index from selected differentials', () => {
    const selected = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0];
    assertEqual(calculateHandicapIndex(selected, 0), 13.5);
  });

  it('applies adjustment correctly', () => {
    assertEqual(calculateHandicapIndex([10.0], 2.0), 8.0);
  });

  it('truncates to 1 decimal (not rounds): 14.58 → 14.5', () => {
    // avg of [14.5, 14.67] = 14.585 → truncate to 14.5
    assertEqual(calculateHandicapIndex([14.5, 14.67], 0), 14.5);
  });

  it('applies soft cap: 50% of excess above low + 3.0', () => {
    // Low = 10.0, raw = 15.0
    // Soft cap threshold = 13.0; excess = 2.0; 50% = 1.0
    // Result = 13.0 + 1.0 = 14.0
    assertEqual(calculateHandicapIndex([15.0], 0, 10.0), 14.0);
  });

  it('applies hard cap: cannot exceed low + 5.0', () => {
    // Low = 10.0, raw = 20.0
    // Soft: 13.0 + (20.0-13.0)*0.5 = 16.5
    // Hard: 15.0 (capped)
    assertEqual(calculateHandicapIndex([20.0], 0, 10.0), 15.0);
  });

  it('caps at maximum 54.0', () => {
    assertEqual(calculateHandicapIndex([60.0], 0), 54.0);
  });

  it('allows negative handicap index', () => {
    assertEqual(calculateHandicapIndex([-2.5], 0), -2.5);
  });

  it('3-round scenario: lowest 1, minus 2.0', () => {
    const sel = selectDifferentials([12.0, 8.0, 15.0]);
    assertEqual(calculateHandicapIndex(sel.selectedDifferentials, sel.adjustment), 6.0);
  });

  it('5-round scenario: lowest 1, no adjustment', () => {
    const sel = selectDifferentials([12.0, 8.0, 15.0, 10.0, 14.0]);
    assertEqual(calculateHandicapIndex(sel.selectedDifferentials, sel.adjustment), 8.0);
  });

  it('8-round scenario: lowest 2, no adjustment', () => {
    const sel = selectDifferentials([15.0, 8.0, 12.0, 18.0, 14.0, 9.0, 16.0, 13.0]);
    assertEqual(calculateHandicapIndex(sel.selectedDifferentials, sel.adjustment), 8.5);
  });

  it('20-round scenario: lowest 8 of 20', () => {
    const diffs = Array.from({ length: 20 }, (_, i) => 5.0 + i);
    const sel = selectDifferentials(diffs);
    // Lowest 8: 5..12, avg = 8.5
    assertEqual(calculateHandicapIndex(sel.selectedDifferentials, sel.adjustment), 8.5);
  });
});

describe('calculateCourseHandicap', () => {
  it('USGA example: index 10.5, slope 125, rating 71.2, par 72 → 11', () => {
    // 10.5 * (125/113) + (71.2 - 72) = 11.615... - 0.8 = 10.815... → 11
    assertEqual(calculateCourseHandicap(10.5, 125, 71.2, 72), 11);
  });

  it('standard slope with matching rating/par', () => {
    assertEqual(calculateCourseHandicap(15.0, 113, 72.0, 72), 15);
  });

  it('adjusts for course rating above par', () => {
    // 10.0 * (130/113) + (74.0-72) = 11.504 + 2 = 13.504 → 14
    assertEqual(calculateCourseHandicap(10.0, 130, 74.0, 72), 14);
  });

  it('adjusts for course rating below par', () => {
    // 10.0 * (110/113) + (70.0-72) = 9.734 - 2 = 7.734 → 8
    assertEqual(calculateCourseHandicap(10.0, 110, 70.0, 72), 8);
  });

  it('handles zero handicap index', () => {
    assertEqual(calculateCourseHandicap(0, 125, 71.2, 72), -1);
  });

  it('handles plus handicap (negative index)', () => {
    // -2.0 * (130/113) + (73.0 - 72) = -2.3009 + 1.0 = -1.3 → -1
    assertEqual(calculateCourseHandicap(-2.0, 130, 73.0, 72), -1);
  });
});

describe('calculateNetScore', () => {
  it('subtracts course handicap from gross', () => {
    assertEqual(calculateNetScore(85, 12), 73);
  });

  it('handles zero handicap', () => {
    assertEqual(calculateNetScore(72, 0), 72);
  });

  it('handles plus handicap (negative course handicap)', () => {
    assertEqual(calculateNetScore(70, -2), 72);
  });
});

describe('calculateIntegrity', () => {
  it('returns CLEAN for consistent player', () => {
    const diffs = Array.from({ length: 20 }, () => ({
      roundId: 'r', adjustedGrossScore: 82, courseRating: 72,
      slopeRating: 113, differential: 10.0, playedAt: '2026-03-01',
    }));
    const rounds = Array.from({ length: 20 }, () => ({
      hole_scores: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, gross: 4 })),
      played_at: '2026-03-01',
    }));
    const history = [{ index: 10.0, date: '2025-12-01' }];
    const result = calculateIntegrity(diffs, 10.0, rounds, history);
    assertEqual(result.label, 'CLEAN');
    assertEqual(result.scoreVariance, 'Low');
    assertEqual(result.roundCompletion, 100);
  });

  it('flags high variance', () => {
    const diffs = Array.from({ length: 20 }, (_, i) => ({
      roundId: 'r', adjustedGrossScore: 82, courseRating: 72,
      slopeRating: 113, differential: i % 2 === 0 ? 5.0 : 25.0, playedAt: '2026-03-01',
    }));
    const rounds = Array.from({ length: 20 }, () => ({
      hole_scores: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, gross: 4 })),
      played_at: '2026-03-01',
    }));
    const result = calculateIntegrity(diffs, 10.0, rounds, []);
    assertEqual(result.scoreVariance, 'High');
  });

  it('penalizes incomplete rounds', () => {
    const diffs = Array.from({ length: 10 }, () => ({
      roundId: 'r', adjustedGrossScore: 82, courseRating: 72,
      slopeRating: 113, differential: 10.0, playedAt: '2026-03-01',
    }));
    // 5 complete, 5 incomplete
    const rounds = Array.from({ length: 10 }, (_, i) => ({
      hole_scores: i < 5
        ? Array.from({ length: 18 }, (_, j) => ({ hole: j + 1, gross: 4 }))
        : Array.from({ length: 9 }, (_, j) => ({ hole: j + 1, gross: 4 })),
      played_at: '2026-03-01',
    }));
    const result = calculateIntegrity(diffs, 10.0, rounds, []);
    assertEqual(result.roundCompletion, 50);
    // 5 incomplete × 5 = -25 penalty, so score ≤ 75
    assert(result.fairPlayScore <= 75, `Expected ≤ 75, got ${result.fairPlayScore}`);
  });
});

// ─── Report ─────────────────────────────────────────────────────────────

console.log(`\n  ─────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log(`\n  Failures:`);
  failures.forEach(f => console.log(f));
}
console.log('');

if (failed > 0) process.exit(1);
