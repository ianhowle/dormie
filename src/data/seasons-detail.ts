// FedEx Cup-style season computation
// Future: wire totals to Supabase `season_standings` and `round_results` tables

export type SeasonStanding = {
  playerId: string;
  playerName: string;
  points: number;
  rank: number;
  eventsPlayed: number;
  wins: number;
  topFives: number;
  topTens: number;
};

export type PlayoffStatus = 'regular' | 'playoffs' | 'finals' | 'completed';

// ---------------------------------------------------------------------------
// Points table: positions 1-10 earn points; anything 11+ earns 0
// ---------------------------------------------------------------------------
const BASE_POINTS: number[] = [25, 20, 16, 12, 10, 8, 6, 4, 2, 1];

/**
 * Calculate FedEx-style points for a given finish position.
 *
 * @param position       1-based finishing position
 * @param weekMultiplier 2 for majors, 1.5 for playoffs, 1 for regular events
 */
export function calculateFedExPoints(
  position: number,
  weekMultiplier: number,
): number {
  if (position < 1 || position > BASE_POINTS.length) return 0;
  const base = BASE_POINTS[position - 1];
  return Math.round(base * weekMultiplier);
}

/**
 * Return the number of players who survive a playoff cut.
 *
 * @param totalPlayers total field size before the cut
 * @param cutPercent   one of the allowed percentage thresholds
 */
export function getPlayoffCutLine(
  totalPlayers: number,
  cutPercent: 25 | 33 | 50 | 67 | 75,
): number {
  return Math.floor(totalPlayers * cutPercent / 100);
}

/**
 * Aggregate per-week scores into season totals, optionally dropping each
 * player's single worst week (minimum 3 weeks played required for a drop).
 *
 * @param weekScores  Array of weeks; each week is an array of
 *                    { playerId, weekPoints } entries (players may be absent
 *                    from a given week's array).
 * @param dropWorst   When true and a player has played 3+ weeks, drop their
 *                    single lowest-scoring week.
 * @param minWeeks    Minimum weeks a player must have played to appear in the
 *                    output (pass 1 to include everyone with at least one
 *                    result).
 */
export function calculateStandingsWithDrops(
  weekScores: { playerId: string; weekPoints: number }[][],
  dropWorst: boolean,
  minWeeks: number,
): { playerId: string; totalPoints: number; droppedWeek: number | null }[] {
  // Collect all weeks per player: Map<playerId, number[]>
  const playerWeeks = new Map<string, number[]>();

  for (const week of weekScores) {
    for (const entry of week) {
      if (!playerWeeks.has(entry.playerId)) {
        playerWeeks.set(entry.playerId, []);
      }
      playerWeeks.get(entry.playerId)!.push(entry.weekPoints);
    }
  }

  const results: { playerId: string; totalPoints: number; droppedWeek: number | null }[] = [];

  for (const [playerId, weeks] of playerWeeks) {
    if (weeks.length < minWeeks) continue;

    let droppedWeek: number | null = null;
    let scoringWeeks = [...weeks];

    if (dropWorst && weeks.length >= 3) {
      const minScore = Math.min(...scoringWeeks);
      const dropIdx = scoringWeeks.indexOf(minScore);
      droppedWeek = scoringWeeks[dropIdx];
      scoringWeeks = [
        ...scoringWeeks.slice(0, dropIdx),
        ...scoringWeeks.slice(dropIdx + 1),
      ];
    }

    const totalPoints = scoringWeeks.reduce((sum, pts) => sum + pts, 0);
    results.push({ playerId, totalPoints, droppedWeek });
  }

  // Sort descending by total points
  results.sort((a, b) => b.totalPoints - a.totalPoints);
  return results;
}

/**
 * Project a player's season total using a DNS (did-not-start) average fill
 * for any missing weeks.
 *
 * If the player has played fewer rounds than `minRounds`, each missing week
 * is filled with the average of the weeks they have played.  The function
 * returns the sum of all weeks after filling.
 *
 * @param playerWeekPoints  Points actually earned, one entry per played week
 * @param minRounds         Target number of rounds for a full season
 */
export function calculateDnsAverage(
  playerWeekPoints: number[],
  minRounds: number,
): number {
  const played = playerWeekPoints.length;

  if (played === 0) return 0;
  if (played >= minRounds) {
    return playerWeekPoints.reduce((sum, pts) => sum + pts, 0);
  }

  const average = playerWeekPoints.reduce((sum, pts) => sum + pts, 0) / played;
  const missingWeeks = minRounds - played;
  const filledTotal =
    playerWeekPoints.reduce((sum, pts) => sum + pts, 0) +
    missingWeeks * average;

  return filledTotal;
}
