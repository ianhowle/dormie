/**
 * Handicap Service — World Handicap System (WHS) compliant calculations.
 *
 * Reference: USGA Handicap System (effective January 2024)
 * https://www.usga.org/handicapping/roh/Content/rules/Appendix%20C%20Calculation%20of%20a%20Handicap%20Index.htm
 *
 * Every pure function is unit-testable with no side effects.
 * The async `recalculatePlayerHandicap` function is the only one that
 * touches Supabase.
 */

import { supabase } from '../lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ScoreDifferential {
  roundId: string;
  adjustedGrossScore: number;
  courseRating: number;
  slopeRating: number;
  differential: number;
  playedAt: string;
}

export interface DifferentialSelection {
  selectedDifferentials: number[];
  adjustment: number;
  count: number;
}

export interface HandicapResult {
  handicapIndex: number;
  differentials: ScoreDifferential[];
  trend: number[];
}

export interface IntegrityResult {
  fairPlayScore: number;
  label: 'CLEAN' | 'REVIEW' | 'FLAG';
  scoreVariance: 'Low' | 'Medium' | 'High';
  handicapTrend: 'Improving' | 'Consistent' | 'Rising';
  roundCompletion: number;
}

// ─── Pure Functions ─────────────────────────────────────────────────────

/**
 * WHS Rule 5.1 — Score Differential Calculation.
 *
 * Converts a round's adjusted gross score into a score differential
 * that normalizes for course difficulty.
 *
 * Formula: (113 / Slope Rating) × (Adjusted Gross Score − Course Rating − PCC)
 *
 * The result is TRUNCATED (not rounded) to one decimal place per WHS rules.
 *
 * @param adjustedGrossScore - Gross score after Net Double Bogey adjustment
 * @param courseRating       - USGA Course Rating for the tees played
 * @param slopeRating        - USGA Slope Rating for the tees played (55–155)
 * @param pcc                - Playing Conditions Calculation adjustment (default 0)
 * @returns Score differential truncated to 1 decimal
 */
export function calculateScoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number,
  pcc: number = 0,
): number {
  const differential = (113 / slopeRating) * (adjustedGrossScore - courseRating - pcc);
  return Math.floor(differential * 10) / 10;
}

/**
 * WHS Rule 3.1 — Net Double Bogey Adjustment (Maximum Hole Score).
 *
 * For handicap purposes, the maximum score on any hole is limited to
 * Net Double Bogey: par + 2 + handicap strokes received on that hole.
 *
 * Handicap stroke allocation follows WHS stroke index rules:
 * - A player with Course Handicap N receives 1 stroke on the N hardest holes
 *   (stroke index 1 through N).
 * - If Course Handicap exceeds 18, the player receives 2 strokes on holes
 *   with stroke index 1 through (Course Handicap − 18), and 1 stroke on the rest.
 * - If Course Handicap exceeds 36, allocation continues analogously.
 *
 * @param holeScores        - Array of actual gross scores per hole (18 values)
 * @param holePars          - Array of par values per hole (18 values)
 * @param courseHandicap    - Player's course handicap for this course
 * @param holeStrokeIndexes - Array of stroke indexes per hole (1–18)
 * @returns Adjusted gross score (sum of capped hole scores)
 */
export function applyNetDoubleBogeyAdjustment(
  holeScores: number[],
  holePars: number[],
  courseHandicap: number,
  holeStrokeIndexes: number[],
): number {
  let adjustedTotal = 0;

  for (let i = 0; i < holeScores.length; i++) {
    const par = holePars[i];
    const strokeIndex = holeStrokeIndexes[i];
    const actualScore = holeScores[i];

    // Calculate handicap strokes received on this hole
    let strokesOnHole = 0;
    if (courseHandicap > 0) {
      // First 18 strokes: 1 per hole in stroke index order
      if (courseHandicap >= strokeIndex) strokesOnHole++;
      // Strokes 19–36: second stroke in stroke index order
      if (courseHandicap >= 18 + strokeIndex) strokesOnHole++;
      // Strokes 37–54: third stroke in stroke index order
      if (courseHandicap >= 36 + strokeIndex) strokesOnHole++;
    }

    // Maximum hole score = par + 2 + handicap strokes on this hole
    const maxScore = par + 2 + strokesOnHole;
    adjustedTotal += Math.min(actualScore, maxScore);
  }

  return adjustedTotal;
}

/**
 * WHS Rule 5.2 — Differential Selection Table.
 *
 * Determines how many of the lowest score differentials to use and
 * what adjustment to apply based on the number of acceptable scores
 * in the scoring record (maximum 20 most recent).
 *
 * Selection table (USGA):
 *   3 rounds  → lowest 1, subtract 2.0
 *   4 rounds  → lowest 1, subtract 1.0
 *   5 rounds  → lowest 1, no adjustment
 *   6 rounds  → lowest 2, subtract 1.0
 *   7–8       → lowest 2, no adjustment
 *   9–11      → lowest 3, no adjustment
 *   12–14     → lowest 4, no adjustment
 *   15–16     → lowest 5, no adjustment
 *   17–18     → lowest 6, no adjustment
 *   19        → lowest 7, no adjustment
 *   20        → lowest 8, no adjustment
 *
 * @param allDifferentials - All differentials sorted by date (most recent first).
 *                           Only the 20 most recent are considered.
 * @returns Object with selected differentials, adjustment value, and count used
 */
export function selectDifferentials(allDifferentials: number[]): DifferentialSelection {
  // Take only the 20 most recent
  const recent = allDifferentials.slice(0, 20);
  const n = recent.length;

  if (n < 3) {
    return { selectedDifferentials: [], adjustment: 0, count: 0 };
  }

  let numToSelect: number;
  let adjustment: number;

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
  else { numToSelect = 8; adjustment = 0; } // n === 20

  // Sort ascending (lowest first) to select the best differentials
  const sorted = [...recent].sort((a, b) => a - b);
  const selected = sorted.slice(0, numToSelect);

  return {
    selectedDifferentials: selected,
    adjustment,
    count: numToSelect,
  };
}

/**
 * WHS Rule 5.3 — Handicap Index Calculation.
 *
 * Computes the Handicap Index from the selected differentials:
 * 1. Average the selected differentials.
 * 2. Subtract the adjustment from the selection table.
 * 3. Apply Soft Cap: if result exceeds Low Handicap Index + 3.0,
 *    only 50% of the excess above that threshold is added.
 * 4. Apply Hard Cap: result cannot exceed Low Handicap Index + 5.0.
 * 5. Cap at maximum 54.0 (WHS maximum).
 * 6. TRUNCATE to 1 decimal place (not round — per WHS specification).
 *
 * @param selectedDifferentials - The best differentials chosen by selectDifferentials
 * @param adjustment            - Adjustment value from the selection table
 * @param lowHandicapIndex      - Lowest Handicap Index in the last 365 days (for cap checks)
 * @returns Handicap Index truncated to 1 decimal
 */
export function calculateHandicapIndex(
  selectedDifferentials: number[],
  adjustment: number,
  lowHandicapIndex?: number,
): number {
  if (selectedDifferentials.length === 0) return 0;

  const avg =
    selectedDifferentials.reduce((sum, d) => sum + d, 0) /
    selectedDifferentials.length;
  let index = avg - adjustment;

  // Apply soft and hard caps if we have a low handicap index reference
  if (lowHandicapIndex !== undefined && lowHandicapIndex !== null) {
    const softCapThreshold = lowHandicapIndex + 3.0;
    const hardCapLimit = lowHandicapIndex + 5.0;

    if (index > softCapThreshold) {
      // Soft cap: only 50% of excess above threshold
      index = softCapThreshold + (index - softCapThreshold) * 0.5;
    }

    // Hard cap: absolute maximum above low index
    if (index > hardCapLimit) {
      index = hardCapLimit;
    }
  }

  // WHS maximum Handicap Index
  if (index > 54.0) index = 54.0;

  // Negative handicaps (scratch/plus) are allowed — floor at reasonable negative
  // TRUNCATE to 1 decimal (not round)
  return Math.floor(index * 10) / 10;
}

/**
 * WHS Rule 6.1 — Course Handicap Calculation.
 *
 * Converts a player's Handicap Index to a Course Handicap for a
 * specific set of tees. This determines the number of strokes
 * the player receives (or gives) at that course.
 *
 * Formula: Handicap Index × (Slope Rating / 113) + (Course Rating − Par)
 * Result is ROUNDED to the nearest whole number.
 *
 * @param handicapIndex - Player's current Handicap Index
 * @param slopeRating   - Slope Rating of the tees being played
 * @param courseRating   - Course Rating of the tees being played
 * @param par           - Par of the course
 * @returns Course Handicap rounded to nearest integer
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number,
): number {
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - par));
}

/**
 * WHS Rule 3.2 — Net Score Calculation.
 *
 * The Net Score is the gross score minus the player's Course Handicap.
 *
 * @param grossScore     - Player's total gross score for the round
 * @param courseHandicap - Player's Course Handicap for the course played
 * @returns Net score
 */
export function calculateNetScore(
  grossScore: number,
  courseHandicap: number,
): number {
  return grossScore - courseHandicap;
}

// ─── Async Service Function ─────────────────────────────────────────────

/**
 * WHS Full Recalculation — Recalculates a player's Handicap Index from
 * their scoring record stored in Supabase.
 *
 * Steps:
 * 1. Fetch all rounds (last 20) with course data (rating, slope, par, hole_data).
 * 2. For each round, apply Net Double Bogey adjustment if hole scores exist.
 * 3. Calculate each score differential.
 * 4. Apply the selection table to choose the best differentials.
 * 5. Retrieve the Low Handicap Index (lowest in last 365 days).
 * 6. Calculate the new Handicap Index with soft/hard caps.
 * 7. Store differentials in handicap_differentials table.
 * 8. Update the user's profile with the new index.
 *
 * @param playerId - Supabase user ID
 * @returns HandicapResult with index, differentials, and trend data
 */
export async function recalculatePlayerHandicap(
  playerId: string,
): Promise<HandicapResult> {
  // 1. Fetch recent rounds with course data.
  // For virtual/async rounds the course row may be absent, but slope/rating
  // are denormalized onto the round itself — include those fields so those
  // rounds still count toward the handicap.
  const { data: rounds, error: roundsErr } = await supabase
    .from('rounds')
    .select('id, gross_score, hole_scores, played_at, course_slope, course_rating, course:courses(par, slope, rating, hole_data)')
    .eq('user_id', playerId)
    .order('played_at', { ascending: false })
    .limit(20);

  if (roundsErr) throw roundsErr;
  if (!rounds || rounds.length < 3) {
    return { handicapIndex: 0, differentials: [], trend: [] };
  }

  // 2–3. Calculate differentials for each round
  const differentials: ScoreDifferential[] = [];

  for (const round of rounds) {
    const course = round.course as any;
    // Prefer denormalized slope/rating on the round (always present for
    // rounds logged with the virtual/async flow). Fall back to the joined
    // Course row for legacy rounds.
    const slopeRating: number | null =
      (round as any).course_slope ?? course?.slope ?? null;
    const courseRating: number | null =
      (round as any).course_rating ?? course?.rating ?? null;
    if (!slopeRating || !courseRating) continue;
    const par: number = course?.par ?? 72;

    let adjustedGross = round.gross_score;

    // Apply Net Double Bogey if we have hole-level data
    if (round.hole_scores && Array.isArray(round.hole_scores) && round.hole_scores.length > 0) {
      const holeScores = (round.hole_scores as any[]).map((h: any) => h.gross);
      const holeData = course.hole_data as any[] | null;

      if (holeData && holeData.length > 0) {
        const holePars = holeData.map((h: any) => h.par ?? 4);
        const holeStrokeIndexes = holeData.map((h: any) => h.strokeIndex ?? h.number);

        // We need the player's current approximate handicap to compute course handicap
        // Use the gross-based estimate: (gross - rating) * 113 / slope as approximation
        const roughDiff = ((round.gross_score - courseRating) * 113) / slopeRating;
        const approxCourseHcp = Math.round(roughDiff * (slopeRating / 113));

        adjustedGross = applyNetDoubleBogeyAdjustment(
          holeScores,
          holePars,
          Math.max(0, approxCourseHcp),
          holeStrokeIndexes,
        );
      }
    }

    const differential = calculateScoreDifferential(
      adjustedGross,
      courseRating,
      slopeRating,
    );

    differentials.push({
      roundId: round.id,
      adjustedGrossScore: adjustedGross,
      courseRating,
      slopeRating,
      differential,
      playedAt: round.played_at,
    });
  }

  if (differentials.length < 3) {
    return { handicapIndex: 0, differentials: [], trend: [] };
  }

  // 4. Select differentials using the WHS table
  const allDiffs = differentials.map((d) => d.differential);
  const selection = selectDifferentials(allDiffs);

  // 5. Retrieve Low Handicap Index (lowest in last 365 days)
  let lowHandicapIndex: number | undefined;
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('low_handicap_index')
      .eq('id', playerId)
      .single();
    if (userData?.low_handicap_index != null) {
      lowHandicapIndex = Number(userData.low_handicap_index);
    }
  } catch {
    // If column doesn't exist yet, skip cap logic
  }

  // 6. Calculate the new Handicap Index
  const handicapIndex = calculateHandicapIndex(
    selection.selectedDifferentials,
    selection.adjustment,
    lowHandicapIndex,
  );

  // 7. Store differentials in handicap_differentials table
  try {
    // Clear existing differentials for this user
    await supabase
      .from('handicap_differentials')
      .delete()
      .eq('user_id', playerId);

    // Insert new differentials
    const rows = differentials.map((d) => ({
      user_id: playerId,
      round_id: d.roundId,
      adjusted_gross_score: d.adjustedGrossScore,
      course_rating: d.courseRating,
      slope_rating: d.slopeRating,
      differential: d.differential,
      played_at: d.playedAt,
    }));

    await supabase.from('handicap_differentials').insert(rows);
  } catch {
    // Table may not exist yet — non-critical
  }

  // 8. Update the user's profile
  const updatePayload: Record<string, any> = {
    handicap_index: handicapIndex,
    handicap_last_updated: new Date().toISOString(),
  };

  // Update low handicap index if current is lower
  if (lowHandicapIndex === undefined || handicapIndex < lowHandicapIndex) {
    updatePayload.low_handicap_index = handicapIndex;
  }

  await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', playerId);

  // Also update auth metadata so profile UI picks it up immediately
  await supabase.auth.updateUser({
    data: { handicap_index: handicapIndex },
  });

  // Build trend: running handicap index at each point in the scoring record
  const trend = buildHandicapTrend(differentials);

  return { handicapIndex, differentials, trend };
}

/**
 * Builds a handicap trend array showing the handicap index at each point
 * in the scoring record (from oldest to newest).
 *
 * For each position i (where i >= 2, i.e., 3+ rounds available), we compute
 * the handicap index using all rounds up to and including position i.
 */
function buildHandicapTrend(differentials: ScoreDifferential[]): number[] {
  // Differentials are in date-descending order; reverse for chronological
  const chronological = [...differentials].reverse();
  const trend: number[] = [];

  for (let i = 2; i < chronological.length; i++) {
    const window = chronological.slice(0, i + 1).map((d) => d.differential);
    const selection = selectDifferentials(window);
    if (selection.selectedDifferentials.length > 0) {
      const idx = calculateHandicapIndex(
        selection.selectedDifferentials,
        selection.adjustment,
      );
      trend.push(idx);
    }
  }

  return trend;
}

// ─── Handicap Integrity Monitor ─────────────────────────────────────────

/**
 * Calculates real integrity metrics for the Handicap Integrity Monitor.
 *
 * Evaluates:
 * - Score Variance: standard deviation of last 20 differentials
 * - Handicap Trend: current index vs 90 days ago
 * - Round Completion: percentage of rounds with all 18 holes scored
 * - Fair Play Score: composite 0–100 based on multiple factors
 *
 * @param differentials - Score differentials from recalculatePlayerHandicap
 * @param currentIndex  - Current handicap index
 * @param rounds        - Raw round data for completion checking
 * @param indexHistory   - Array of { index, date } for trend analysis
 */
export function calculateIntegrity(
  differentials: ScoreDifferential[],
  currentIndex: number,
  rounds: Array<{ hole_scores: any[] | null; played_at: string }>,
  indexHistory: Array<{ index: number; date: string }>,
): IntegrityResult {
  // Score Variance: stdev of last 20 differentials
  const diffs = differentials.slice(0, 20).map((d) => d.differential);
  const stdev = calculateStandardDeviation(diffs);

  let scoreVariance: 'Low' | 'Medium' | 'High';
  if (stdev < 3) scoreVariance = 'Low';
  else if (stdev <= 6) scoreVariance = 'Medium';
  else scoreVariance = 'High';

  // Handicap Trend: compare to 90 days ago
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oldEntry = indexHistory.find(
    (h) => new Date(h.date) <= ninetyDaysAgo,
  );
  const oldIndex = oldEntry?.index ?? currentIndex;
  const indexChange = currentIndex - oldIndex;

  let handicapTrend: 'Improving' | 'Consistent' | 'Rising';
  if (indexChange < -1.0) handicapTrend = 'Improving';
  else if (indexChange > 1.0) handicapTrend = 'Rising';
  else handicapTrend = 'Consistent';

  // Round Completion: percentage with all 18 holes
  const totalRounds = rounds.length;
  const completeRounds = rounds.filter((r) => {
    if (!r.hole_scores || !Array.isArray(r.hole_scores)) return false;
    return r.hole_scores.length >= 18;
  }).length;
  const roundCompletion = totalRounds > 0
    ? Math.round((completeRounds / totalRounds) * 100)
    : 100;

  // Fair Play Score: composite 0–100
  let fairPlayScore = 100;

  // High variance penalty
  if (stdev > 6) fairPlayScore -= 15;
  else if (stdev > 4.5) fairPlayScore -= 7;

  // Rapid handicap drop in last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthOldEntry = indexHistory.find(
    (h) => new Date(h.date) <= thirtyDaysAgo,
  );
  if (monthOldEntry && (monthOldEntry.index - currentIndex) > 3.0) {
    fairPlayScore -= 20;
  }

  // Incomplete rounds penalty
  const incompleteCount = totalRounds - completeRounds;
  fairPlayScore -= incompleteCount * 5;

  // Unusually low scores detection (tournament vs casual):
  // Check if any differential is more than 2 stdev below the mean
  if (diffs.length >= 5) {
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const outliers = diffs.filter((d) => d < mean - 2 * stdev).length;
    if (outliers >= 2) fairPlayScore -= 10;
  }

  // Clamp to 0–100
  fairPlayScore = Math.max(0, Math.min(100, fairPlayScore));

  let label: 'CLEAN' | 'REVIEW' | 'FLAG';
  if (fairPlayScore >= 90) label = 'CLEAN';
  else if (fairPlayScore >= 70) label = 'REVIEW';
  else label = 'FLAG';

  return {
    fairPlayScore,
    label,
    scoreVariance,
    handicapTrend,
    roundCompletion,
  };
}

/**
 * Calculates the standard deviation of a numeric array.
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(variance);
}
