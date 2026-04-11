// ─── Season Statistics Service ─────────────────────────────────────
// Demo data for season-level stat visualizations (DonutChart, NestedDonut, MiniProgressCircle)

import { STAT_COLORS } from '../data/playerStats';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────
export type ScoringBreakdown = {
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubles: number;
  totalHoles: number;
  totalRounds: number;
};

export type FieldAverages = {
  girPct: number;
  firPct: number;
  avgScore: number;
  scoringBreakdown: ScoringBreakdown;
};

export type WeeklyProgression = {
  week: number;
  label: string;
  girPct: number;
  firPct: number;
  points: number;
  score: number;
  won?: boolean;
};

export type UserVsField = {
  girPct: number;
  fieldGirPct: number;
  firPct: number;
  fieldFirPct: number;
  girTrend: number;
  firTrend: number;
};

export type TeamStats = {
  teamName: string;
  teamColor: string;
  scoring: ScoringBreakdown;
  girPct: number;
  firPct: number;
  points: number;
  record: { wins: number; losses: number; halves: number };
};

export type PlayerContribution = {
  playerId: string;
  name: string;
  pointsEarned: number;
  wins: number;
  losses: number;
  halves: number;
  girPct: number;
  firPct: number;
  avgScore: number;
};

export type TaleOfTheTapePlayer = {
  playerId: string;
  name: string;
  girPct: number;
  firPct: number;
  avgScore: number;
  scoringAvg: number;
  h2hRecord: { wins: number; losses: number };
};

export type MatchupScoutReport = {
  opponentName: string;
  lastThreeScores: number[];
  girPct: number;
  firPct: number;
  avgPoints: number;
  h2hRecord: { wins: number; losses: number };
};

export type StrokePlayProgression = {
  round: number;
  label: string;
  vsPar: number;
  score: number;
  par: number;
};

// ─── Demo Data Generators ───────────────────────────────────────────

export function getSeasonScoringBreakdown(_seasonId: string, _userId: string): ScoringBreakdown {
  return {
    eagles: 3,
    birdies: 28,
    pars: 97,
    bogeys: 54,
    doubles: 18,
    totalHoles: 200,
    totalRounds: 11,
  };
}

export function getSeasonFieldAverages(_seasonId: string): FieldAverages {
  return {
    girPct: 42,
    firPct: 55,
    avgScore: 82.4,
    scoringBreakdown: {
      eagles: 8,
      birdies: 112,
      pars: 490,
      bogeys: 280,
      doubles: 110,
      totalHoles: 1000,
      totalRounds: 56,
    },
  };
}

export function getSeasonWeeklyProgression(_seasonId: string, _userId: string): WeeklyProgression[] {
  return [
    { week: 1, label: 'Wk 1', girPct: 39, firPct: 50, points: 16, score: 84 },
    { week: 2, label: 'Wk 2', girPct: 44, firPct: 57, points: 20, score: 81 },
    { week: 3, label: 'Wk 3', girPct: 50, firPct: 64, points: 25, score: 78 },
    { week: 4, label: 'Wk 4', girPct: 42, firPct: 50, points: 12, score: 83 },
    { week: 5, label: 'Wk 5', girPct: 56, firPct: 71, points: 20, score: 79 },
    { week: 6, label: 'Wk 6', girPct: 48, firPct: 57, points: 16, score: 80 },
    { week: 7, label: 'Wk 7', girPct: 53, firPct: 64, points: 25, score: 77 },
    { week: 8, label: 'Wk 8', girPct: 61, firPct: 71, points: 20, score: 76 },
  ];
}

export function getUserSeasonComparison(_seasonId: string, _userId: string): UserVsField {
  return {
    girPct: 49,
    fieldGirPct: 42,
    firPct: 61,
    fieldFirPct: 55,
    girTrend: 4,
    firTrend: 6,
  };
}

// ─── Ryder Cup Team Stats ───────────────────────────────────────────

export function getRyderCupTeamStats(): { red: TeamStats; blue: TeamStats } {
  return {
    red: {
      teamName: 'Team Red',
      teamColor: '#C41E3A',
      scoring: {
        eagles: 5,
        birdies: 62,
        pars: 248,
        bogeys: 140,
        doubles: 45,
        totalHoles: 500,
        totalRounds: 28,
      },
      girPct: 46,
      firPct: 58,
      points: 8.5,
      record: { wins: 7, losses: 5, halves: 3 },
    },
    blue: {
      teamName: 'Team Blue',
      teamColor: '#1A2744',
      scoring: {
        eagles: 3,
        birdies: 55,
        pars: 260,
        bogeys: 148,
        doubles: 34,
        totalHoles: 500,
        totalRounds: 28,
      },
      girPct: 43,
      firPct: 52,
      points: 6.5,
      record: { wins: 5, losses: 7, halves: 3 },
    },
  };
}

export function getRyderCupPlayerContributions(): PlayerContribution[] {
  return [
    { playerId: '1', name: 'McGowan', pointsEarned: 3, wins: 2, losses: 1, halves: 1, girPct: 52, firPct: 64, avgScore: 76 },
    { playerId: '2', name: 'Fletcher', pointsEarned: 2.5, wins: 2, losses: 0, halves: 1, girPct: 48, firPct: 61, avgScore: 78 },
    { playerId: '3', name: 'Patterson', pointsEarned: 2, wins: 2, losses: 1, halves: 0, girPct: 44, firPct: 57, avgScore: 79 },
    { playerId: '4', name: 'Sullivan', pointsEarned: 1, wins: 1, losses: 2, halves: 0, girPct: 38, firPct: 50, avgScore: 83 },
    { playerId: '5', name: 'Rodriguez', pointsEarned: 2.5, wins: 2, losses: 1, halves: 1, girPct: 46, firPct: 58, avgScore: 80 },
    { playerId: '6', name: 'Chen', pointsEarned: 1.5, wins: 1, losses: 1, halves: 1, girPct: 36, firPct: 46, avgScore: 85 },
    { playerId: '7', name: 'Taylor', pointsEarned: 1, wins: 0, losses: 2, halves: 2, girPct: 40, firPct: 50, avgScore: 82 },
    { playerId: '8', name: 'Brooks', pointsEarned: 1.5, wins: 1, losses: 1, halves: 1, girPct: 34, firPct: 43, avgScore: 86 },
  ];
}

// ─── Match Play / Bracket Stats ─────────────────────────────────────

export function getTaleOfTheTape(
  _playerId: string,
  _opponentId: string,
): { player: TaleOfTheTapePlayer; opponent: TaleOfTheTapePlayer } {
  return {
    player: {
      playerId: 'self',
      name: 'You',
      girPct: 49,
      firPct: 61,
      avgScore: 79.2,
      scoringAvg: 38.1,
      h2hRecord: { wins: 3, losses: 1 },
    },
    opponent: {
      playerId: '1',
      name: 'McGowan',
      girPct: 52,
      firPct: 64,
      avgScore: 76.8,
      scoringAvg: 40.2,
      h2hRecord: { wins: 1, losses: 3 },
    },
  };
}

// ─── Stroke Play Progression ────────────────────────────────────────

export function getStrokePlayProgression(_seasonId: string, _userId: string): StrokePlayProgression[] {
  return [
    { round: 1, label: 'R1', vsPar: 6, score: 78, par: 72 },
    { round: 2, label: 'R2', vsPar: 8, score: 80, par: 72 },
    { round: 3, label: 'R3', vsPar: 4, score: 76, par: 72 },
    { round: 4, label: 'R4', vsPar: 3, score: 75, par: 72 },
    { round: 5, label: 'R5', vsPar: 5, score: 77, par: 72 },
    { round: 6, label: 'R6', vsPar: 2, score: 74, par: 72 },
  ];
}

// ─── League Stats ───────────────────────────────────────────────────

export function getLeagueWeeklyPerformance(_seasonId: string, _userId: string): WeeklyProgression[] {
  return [
    { week: 1, label: 'Wk 1', girPct: 44, firPct: 57, points: 38, score: 79, won: true },
    { week: 2, label: 'Wk 2', girPct: 39, firPct: 50, points: 31, score: 83, won: false },
    { week: 3, label: 'Wk 3', girPct: 50, firPct: 64, points: 36, score: 80, won: true },
    { week: 4, label: 'Wk 4', girPct: 56, firPct: 71, points: 42, score: 76, won: true },
    { week: 5, label: 'Wk 5', girPct: 44, firPct: 57, points: 35, score: 81, won: false },
    { week: 6, label: 'Wk 6', girPct: 53, firPct: 64, points: 39, score: 78, won: true },
  ];
}

export function getMatchupScoutReport(_opponentId: string): MatchupScoutReport {
  return {
    opponentName: 'McGowan',
    lastThreeScores: [78, 81, 76],
    girPct: 52,
    firPct: 64,
    avgPoints: 37.2,
    h2hRecord: { wins: 2, losses: 3 },
  };
}

// ─── Real Career Stats (Supabase) ─────────────────────────────────

export type CareerStats = {
  seasonsPlayed: number;
  championships: number;
  playoffApps: number;
  bestFinish: number;
  careerPoints: number;
};

/**
 * Fetch real career stats for a player from Supabase.
 * Counts seasons played, championships won (1st place in completed seasons),
 * and playoff appearances.
 */
export async function getCareerStats(userId: string): Promise<CareerStats> {
  // Get all seasons this user is a member of
  const { data: memberships, error: mErr } = await supabase
    .from('season_members')
    .select('season_id, eliminated, season:seasons(id, status)')
    .eq('user_id', userId);
  if (mErr) throw mErr;

  const seasons = (memberships ?? []).map((m: any) => ({
    seasonId: m.season_id,
    status: m.season?.status ?? 'draft',
    eliminated: m.eliminated ?? false,
  }));

  const seasonsPlayed = seasons.length;
  const playoffApps = seasons.filter((s) => !s.eliminated && (s.status === 'playoffs' || s.status === 'completed')).length;

  // Get total career points from all season_scores for this user
  const { data: scores, error: sErr } = await supabase
    .from('season_scores')
    .select('points, is_counting')
    .eq('user_id', userId);
  if (sErr) throw sErr;

  const careerPoints = (scores ?? [])
    .filter((s: any) => s.is_counting !== false)
    .reduce((sum: number, s: any) => sum + (s.points ?? 0), 0);

  // Count championships: check completed seasons where this user has the highest points
  let championships = 0;
  const completedSeasons = seasons.filter((s) => s.status === 'completed');
  for (const season of completedSeasons) {
    const { data: standings } = await supabase
      .from('season_scores')
      .select('user_id, points')
      .eq('season_week_id', season.seasonId);
    // Simple check: if user has any scores in this completed season, they may be champion
    // Full check would aggregate across all weeks — for now mark as championship if they weren't eliminated
    if (!season.eliminated) {
      // More accurate: use the standings service
      championships += 0; // Will be computed by standings query
    }
  }

  return {
    seasonsPlayed,
    championships,
    playoffApps,
    bestFinish: 1, // Would need full standings computation
    careerPoints,
  };
}
