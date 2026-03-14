/**
 * Monthly stats aggregation for digest cards and Year in Review.
 * Stored per-month for historical tracking.
 */

export type MonthGrade = 'A' | 'B' | 'C' | 'D';

export type MonthlyStats = {
  year: number;
  month: number; // 1-indexed
  roundsLogged: number;
  scoringAverage: number | null;
  bestRound: { score: number; course: string } | null;
  handicapStart: number | null;
  handicapEnd: number | null;
  newCourses: number;
  tripsCompleted: number;
  h2hRecord: { wins: number; losses: number };
  grade: MonthGrade;
};

/**
 * Compute month grade:
 * A = 8+ rounds AND handicap improved
 * B = 4-7 rounds AND handicap stable or improved
 * C = 1-3 rounds
 * D = 0 rounds
 */
export function computeMonthGrade(
  roundsLogged: number,
  handicapStart: number | null,
  handicapEnd: number | null,
): MonthGrade {
  if (roundsLogged === 0) return 'D';
  if (roundsLogged <= 3) return 'C';

  const improved =
    handicapStart != null && handicapEnd != null && handicapEnd <= handicapStart;

  if (roundsLogged >= 8 && improved) return 'A';
  if (roundsLogged >= 4 && improved) return 'B';

  // 4-7 rounds but handicap went up
  if (roundsLogged >= 4) return 'B';

  return 'C';
}

/**
 * Build MonthlyStats from raw round data.
 */
export function computeMonthlyStats(
  year: number,
  month: number,
  rounds: { score: number; course: string; date: string }[],
  handicapStart: number | null,
  handicapEnd: number | null,
  h2hRecord: { wins: number; losses: number },
  tripsCompleted: number,
): MonthlyStats {
  const roundsLogged = rounds.length;
  const scoringAverage =
    roundsLogged > 0
      ? rounds.reduce((sum, r) => sum + r.score, 0) / roundsLogged
      : null;

  const bestRound =
    roundsLogged > 0
      ? rounds.reduce((best, r) => (r.score < best.score ? r : best))
      : null;

  // Count unique courses not seen before this month (simplified — caller provides)
  const uniqueCourses = new Set(rounds.map((r) => r.course));

  const grade = computeMonthGrade(roundsLogged, handicapStart, handicapEnd);

  return {
    year,
    month,
    roundsLogged,
    scoringAverage,
    bestRound: bestRound ? { score: bestRound.score, course: bestRound.course } : null,
    handicapStart,
    handicapEnd,
    newCourses: uniqueCourses.size,
    tripsCompleted,
    h2hRecord,
    grade,
  };
}

/** Grade descriptions for UI */
export const GRADE_COPY: Record<MonthGrade, string> = {
  A: 'Outstanding month',
  B: 'Solid month',
  C: 'Room to grow',
  D: 'Get back out there!',
};

/** Get the previous month name */
export function getPreviousMonthName(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prev.toLocaleString('en-US', { month: 'long' }).toUpperCase();
}

/** Check if we should show the monthly digest (1st-3rd of month) */
export function shouldShowMonthlyDigest(): boolean {
  const day = new Date().getDate();
  return day >= 1 && day <= 3;
}
