/**
 * Streak tracking for competition psychology.
 * "Don't break the chain" — the secret sauce of fantasy sports.
 */

export type Streak = {
  id: string;
  emoji: string;
  label: string;
  count: number;
  detail: string;
  type: 'scoring' | 'handicap' | 'h2h' | 'rounds';
};

export type StreakInput = {
  recentScores: number[];
  handicapTrend: number[];
  h2hResults: { opponent: string; wins: number; losses: number }[];
  roundDates: Date[];
};

/**
 * Compute active streaks from player data.
 * Returns array of currently active streaks, sorted by impressiveness.
 */
export function computeStreaks(input: StreakInput): Streak[] {
  const streaks: Streak[] = [];

  // 1. Scoring streak: consecutive rounds under a threshold
  if (input.recentScores.length >= 3) {
    const under80 = countConsecutiveFromEnd(input.recentScores, (s) => s < 80);
    if (under80 >= 3) {
      streaks.push({
        id: 'under80',
        emoji: '🔥',
        label: `${under80}-round streak under 80`,
        count: under80,
        detail: `Last ${under80} rounds all broke 80`,
        type: 'scoring',
      });
    }

    const under90 = countConsecutiveFromEnd(input.recentScores, (s) => s < 90);
    if (under90 >= 5 && under80 < 3) {
      streaks.push({
        id: 'under90',
        emoji: '🔥',
        label: `${under90}-round streak under 90`,
        count: under90,
        detail: `Consistent golf — ${under90} straight under 90`,
        type: 'scoring',
      });
    }
  }

  // 2. Handicap improvement streak
  if (input.handicapTrend.length >= 3) {
    const improving = countConsecutiveFromEnd(
      input.handicapTrend.map((_, i, arr) =>
        i === 0 ? 0 : arr[i] - arr[i - 1],
      ).slice(1),
      (diff) => diff < 0,
    );
    if (improving >= 3) {
      streaks.push({
        id: 'hcp_improve',
        emoji: '📈',
        label: `${improving} rounds of handicap improvement`,
        count: improving,
        detail: 'Your game is trending in the right direction',
        type: 'handicap',
      });
    }
  }

  // 3. H2H win streaks
  input.h2hResults.forEach((h2h) => {
    if (h2h.wins >= 3) {
      streaks.push({
        id: `h2h_${h2h.opponent}`,
        emoji: '⚔️',
        label: `${h2h.wins}-match win streak vs ${h2h.opponent}`,
        count: h2h.wins,
        detail: `Dominant run against ${h2h.opponent}`,
        type: 'h2h',
      });
    }
  });

  // 4. Rounds per week streak
  if (input.roundDates.length >= 2) {
    const weeksWithRounds = countConsecutiveWeeksWithRounds(input.roundDates);
    if (weeksWithRounds >= 4) {
      streaks.push({
        id: 'weekly',
        emoji: '📅',
        label: `${weeksWithRounds} weeks straight playing`,
        count: weeksWithRounds,
        detail: 'Consistency is the key to improvement',
        type: 'rounds',
      });
    }
  }

  // Sort by count descending
  return streaks.sort((a, b) => b.count - a.count);
}

function countConsecutiveFromEnd<T>(arr: T[], predicate: (item: T) => boolean): number {
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) count++;
    else break;
  }
  return count;
}

function countConsecutiveWeeksWithRounds(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort((a, b) => b.getTime() - a.getTime());
  const now = new Date();
  let weekCount = 0;
  let checkWeekStart = getWeekStart(now);

  for (let i = 0; i < 52; i++) {
    const weekEnd = new Date(checkWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const hasRound = sorted.some(
      (d) => d.getTime() >= checkWeekStart.getTime() && d.getTime() < weekEnd.getTime(),
    );
    if (hasRound) {
      weekCount++;
      checkWeekStart = new Date(checkWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return weekCount;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Weekly digest ──────────────────────────────────────────────────
export type WeeklyDigest = {
  roundsLogged: number;
  avgScore: number | null;
  handicapChange: number | null;
  leaderboardChange: number | null;
};

export function computeWeeklyDigest(
  roundsThisWeek: { score: number }[],
  handicapStart: number | null,
  handicapEnd: number | null,
  positionStart: number | null,
  positionEnd: number | null,
): WeeklyDigest {
  const roundsLogged = roundsThisWeek.length;
  const avgScore =
    roundsLogged > 0
      ? roundsThisWeek.reduce((sum, r) => sum + r.score, 0) / roundsLogged
      : null;
  const handicapChange =
    handicapStart != null && handicapEnd != null
      ? handicapEnd - handicapStart
      : null;
  const leaderboardChange =
    positionStart != null && positionEnd != null
      ? positionStart - positionEnd // positive = moved up
      : null;

  return { roundsLogged, avgScore, handicapChange, leaderboardChange };
}

export function formatWeeklyDigest(digest: WeeklyDigest): string {
  const parts: string[] = [];

  if (digest.roundsLogged > 0) {
    parts.push(`${digest.roundsLogged} round${digest.roundsLogged > 1 ? 's' : ''} logged`);
  }
  if (digest.avgScore != null) {
    parts.push(`avg ${digest.avgScore.toFixed(1)}`);
  }
  if (digest.handicapChange != null && digest.handicapChange !== 0) {
    const dir = digest.handicapChange < 0 ? '↓' : '↑';
    parts.push(`handicap ${dir}${Math.abs(digest.handicapChange).toFixed(1)}`);
  }
  if (digest.leaderboardChange != null && digest.leaderboardChange !== 0) {
    const dir = digest.leaderboardChange > 0 ? 'up' : 'down';
    parts.push(`moved ${dir} ${Math.abs(digest.leaderboardChange)} spot${Math.abs(digest.leaderboardChange) > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}
