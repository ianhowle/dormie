import { supabase } from '../lib/supabase';
import { todayYMD, fromYMD } from '../components/wizard/quick-trip/dateHelpers';

// ─── Types ─────────────────────────────────────────────────────────────

export interface TripStatsOverview {
  totalTrips: number;
  totalWins: number;
  tripAvg: number;
  regularAvg: number;
  diffStrokes: number; // tripAvg - regularAvg, negative when better on trips
  totalRounds: number;
  earliestTripDate: string | null;
  hasData: boolean; // false when user has no completed trips and no rounds
}

export interface TripPerformance {
  tripId: string;
  tripName: string;
  startDate: string;
  endDate: string;
  courseName: string;
  avgScore: number;
  isWinner: boolean;
  rounds: number;
}

export interface CourseStats {
  courseId: string;
  courseName: string;
  timesPlayed: number;
  avgScore: number;
  bestScore: number;
  bestScoreDate: string;
}

export interface YearStats {
  year: number;
  trips: number;
  avgScore: number;
}

export interface StatCallouts {
  mostPlayedCourse: { name: string; times: number } | null;
  longestGap: { months: number; from: string; to: string } | null;
  highestRound: { score: number; date: string; course: string } | null;
  lowestRound: { score: number; date: string; course: string } | null;
}

// ─── Internal helpers ──────────────────────────────────────────────────

type RoundRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  gross_score: number;
  trip_id: string | null;
  played_at: string;
  course_name: string | null;
  course: { id: string; name: string; city: string | null; state: string | null; par: number } | null;
};

async function fetchAllUserRounds(userId: string): Promise<RoundRow[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, user_id, course_id, gross_score, trip_id, played_at, course_name, course:courses(id, name, city, state, par)')
    .eq('user_id', userId)
    .order('played_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RoundRow[];
}

function resolveCourseName(r: RoundRow): string {
  return r.course?.name ?? r.course_name ?? 'Unknown course';
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

// Trip is "completed" for stats purposes when status === 'completed' OR
// the end_date has already passed. Same heuristic as the Trips list —
// uses local-timezone YMD via todayYMD() so the day boundary doesn't
// shift into UTC and bucket today's trips as completed after ~7pm CDT.
function isTripCompleted(t: { status: string | null; end_date: string | null }): boolean {
  if (t.status === 'completed') return true;
  if (!t.end_date) return false;
  return t.end_date < todayYMD();
}

async function fetchCompletedTripsForUser(userId: string): Promise<{
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string | null;
}[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip:trips(id, name, start_date, end_date, status)')
    .eq('user_id', userId);
  if (error) throw error;
  const trips = (data ?? [])
    .map((row: any) => row.trip)
    .filter((t: any): t is NonNullable<typeof t> => !!t)
    .filter((t: any) => isTripCompleted(t));
  return trips as any[];
}

// ─── Service ───────────────────────────────────────────────────────────

export const statsService = {
  async getOverview(userId: string): Promise<TripStatsOverview> {
    const [rounds, completedTrips] = await Promise.all([
      fetchAllUserRounds(userId),
      fetchCompletedTripsForUser(userId),
    ]);

    const tripRounds = rounds.filter((r) => !!r.trip_id);
    const regularRounds = rounds.filter((r) => !r.trip_id);
    const tripAvg = avg(tripRounds.map((r) => r.gross_score));
    const regularAvg = avg(regularRounds.map((r) => r.gross_score));

    // Wins: leaderboard rank 1 across each completed trip. Run in parallel.
    let totalWins = 0;
    if (completedTrips.length > 0) {
      const wins: number[] = await Promise.all(
        completedTrips.map(async (t): Promise<number> => {
          try {
            const { data } = await supabase.rpc('get_trip_leaderboard', { p_trip_id: t.id });
            const top = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null;
            return top?.user_id === userId ? 1 : 0;
          } catch {
            return 0;
          }
        }),
      );
      totalWins = wins.reduce<number>((s, w) => s + w, 0);
    }

    const earliestTripDate =
      completedTrips.length > 0
        ? completedTrips
            .map((t) => t.start_date)
            .sort()[0]
        : null;

    const hasData = completedTrips.length > 0 || rounds.length > 0;

    return {
      totalTrips: completedTrips.length,
      totalWins,
      tripAvg,
      regularAvg,
      diffStrokes: tripAvg - regularAvg,
      totalRounds: rounds.length,
      earliestTripDate,
      hasData,
    };
  },

  async getTripPerformanceList(userId: string): Promise<TripPerformance[]> {
    const completedTrips = await fetchCompletedTripsForUser(userId);
    if (completedTrips.length === 0) return [];

    // Pull rounds for these trips for this user, plus leaderboard rank 1 for win flag.
    const tripIds = completedTrips.map((t) => t.id);
    const { data: roundData, error: roundErr } = await supabase
      .from('rounds')
      .select('trip_id, gross_score, played_at, course_name, course:courses(name)')
      .eq('user_id', userId)
      .in('trip_id', tripIds);
    if (roundErr) throw roundErr;
    const rounds = (roundData ?? []) as unknown as {
      trip_id: string;
      gross_score: number;
      played_at: string;
      course_name: string | null;
      course: { name: string } | null;
    }[];

    const winners = await Promise.all(
      completedTrips.map(async (t) => {
        try {
          const { data } = await supabase.rpc('get_trip_leaderboard', { p_trip_id: t.id });
          const top = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null;
          return [t.id, top?.user_id === userId] as const;
        } catch {
          return [t.id, false] as const;
        }
      }),
    );
    const winnerMap = new Map(winners);

    const out: TripPerformance[] = completedTrips.map((t) => {
      const tripRounds = rounds.filter((r) => r.trip_id === t.id);
      const tripAvgScore = avg(tripRounds.map((r) => r.gross_score));
      const courseName =
        tripRounds[0]?.course?.name ?? tripRounds[0]?.course_name ?? '—';
      return {
        tripId: t.id,
        tripName: t.name,
        startDate: t.start_date,
        endDate: t.end_date,
        courseName,
        avgScore: tripAvgScore,
        isWinner: !!winnerMap.get(t.id),
        rounds: tripRounds.length,
      };
    });

    // Reverse-chronological by start date
    out.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    return out;
  },

  async getCourseBreakdown(userId: string): Promise<CourseStats[]> {
    const rounds = await fetchAllUserRounds(userId);
    if (rounds.length === 0) return [];

    // Group by course_id when present, otherwise by denormalized course_name
    const groups = new Map<string, { name: string; rounds: RoundRow[] }>();
    for (const r of rounds) {
      const key = r.course_id ?? `name:${resolveCourseName(r)}`;
      const existing = groups.get(key);
      if (existing) {
        existing.rounds.push(r);
      } else {
        groups.set(key, { name: resolveCourseName(r), rounds: [r] });
      }
    }

    const out: CourseStats[] = [];
    for (const [key, g] of groups) {
      if (g.rounds.length < 2) continue; // multi-played courses only
      const scores = g.rounds.map((r) => r.gross_score);
      const best = g.rounds.reduce((b, r) => (r.gross_score < b.gross_score ? r : b), g.rounds[0]);
      out.push({
        courseId: key.startsWith('name:') ? key : key,
        courseName: g.name,
        timesPlayed: g.rounds.length,
        avgScore: avg(scores),
        bestScore: best.gross_score,
        bestScoreDate: best.played_at,
      });
    }
    out.sort((a, b) => b.timesPlayed - a.timesPlayed);
    return out;
  },

  async getYearOverYear(userId: string): Promise<YearStats[]> {
    const completedTrips = await fetchCompletedTripsForUser(userId);
    if (completedTrips.length === 0) return [];

    const rounds = await fetchAllUserRounds(userId);
    const tripRoundsByTripId = new Map<string, RoundRow[]>();
    for (const r of rounds) {
      if (!r.trip_id) continue;
      const arr = tripRoundsByTripId.get(r.trip_id) ?? [];
      arr.push(r);
      tripRoundsByTripId.set(r.trip_id, arr);
    }

    // Year derived from start_date — a trip that spans Dec 31 → Jan 1 counts
    // as the start year per spec. fromYMD parses the date string in local
    // time so a trip dated 2026-01-01 doesn't bucket as 2025 in CDT (where
    // new Date('2026-01-01') = 2025-12-31 19:00 local).
    const yearMap = new Map<number, { trips: number; scores: number[] }>();
    for (const t of completedTrips) {
      const year = fromYMD(t.start_date)?.getFullYear() ?? new Date(t.start_date).getFullYear();
      const bucket = yearMap.get(year) ?? { trips: 0, scores: [] };
      bucket.trips += 1;
      const tripRounds = tripRoundsByTripId.get(t.id) ?? [];
      bucket.scores.push(...tripRounds.map((r) => r.gross_score));
      yearMap.set(year, bucket);
    }

    const out: YearStats[] = Array.from(yearMap.entries())
      .map(([year, b]) => ({
        year,
        trips: b.trips,
        avgScore: avg(b.scores),
      }))
      .sort((a, b) => b.year - a.year);
    return out;
  },

  async getCallouts(userId: string): Promise<StatCallouts> {
    const [rounds, completedTrips] = await Promise.all([
      fetchAllUserRounds(userId),
      fetchCompletedTripsForUser(userId),
    ]);

    // Most played course
    let mostPlayedCourse: StatCallouts['mostPlayedCourse'] = null;
    if (rounds.length > 0) {
      const counts = new Map<string, number>();
      for (const r of rounds) {
        const name = resolveCourseName(r);
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (top) mostPlayedCourse = { name: top[0], times: top[1] };
    }

    // Longest gap between completed trip start dates
    let longestGap: StatCallouts['longestGap'] = null;
    if (completedTrips.length >= 2) {
      const sorted = [...completedTrips].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );
      let widest = { from: '', to: '', ms: 0 };
      for (let i = 1; i < sorted.length; i++) {
        const ms =
          new Date(sorted[i].start_date).getTime() -
          new Date(sorted[i - 1].start_date).getTime();
        if (ms > widest.ms) {
          widest = { from: sorted[i - 1].start_date, to: sorted[i].start_date, ms };
        }
      }
      const months = Math.round(widest.ms / (1000 * 60 * 60 * 24 * 30));
      longestGap = { months, from: widest.from, to: widest.to };
    }

    // Highest / lowest rounds
    let highestRound: StatCallouts['highestRound'] = null;
    let lowestRound: StatCallouts['lowestRound'] = null;
    if (rounds.length > 0) {
      const high = rounds.reduce((b, r) => (r.gross_score > b.gross_score ? r : b), rounds[0]);
      const low = rounds.reduce((b, r) => (r.gross_score < b.gross_score ? r : b), rounds[0]);
      highestRound = { score: high.gross_score, date: high.played_at, course: resolveCourseName(high) };
      lowestRound = { score: low.gross_score, date: low.played_at, course: resolveCourseName(low) };
    }

    return { mostPlayedCourse, longestGap, highestRound, lowestRound };
  },
};
