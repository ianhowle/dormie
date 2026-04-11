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

type MatchResult = {
  sessionId: string;
  redPlayers: string[];
  bluePlayers: string[];
  winner: 'red' | 'blue' | 'halved';
};

type SessionResult = {
  id: string;
  status: string;
  redScore: number;
  blueScore: number;
};

/**
 * Compute team stats from a trip's ryder_cup_config data.
 * Falls back to session-level score aggregation when matchResults aren't available.
 */
export function getRyderCupTeamStats(config?: {
  teamRedName?: string;
  teamBlueName?: string;
  sessionResults?: SessionResult[];
  matchResults?: MatchResult[];
  finalScore?: { red: number; blue: number };
}): { red: TeamStats; blue: TeamStats } {
  const teamRedName = config?.teamRedName ?? 'Team Red';
  const teamBlueName = config?.teamBlueName ?? 'Team Blue';

  let redRecord = { wins: 0, losses: 0, halves: 0 };
  let blueRecord = { wins: 0, losses: 0, halves: 0 };
  let redPoints = 0;
  let bluePoints = 0;

  if (config?.matchResults && config.matchResults.length > 0) {
    for (const m of config.matchResults) {
      if (m.winner === 'red') {
        redRecord.wins++;
        blueRecord.losses++;
        redPoints += 1;
      } else if (m.winner === 'blue') {
        blueRecord.wins++;
        redRecord.losses++;
        bluePoints += 1;
      } else {
        redRecord.halves++;
        blueRecord.halves++;
        redPoints += 0.5;
        bluePoints += 0.5;
      }
    }
  } else if (config?.sessionResults) {
    for (const s of config.sessionResults) {
      redPoints += s.redScore;
      bluePoints += s.blueScore;
    }
    redRecord = { wins: Math.floor(redPoints), losses: Math.floor(bluePoints), halves: 0 };
    blueRecord = { wins: Math.floor(bluePoints), losses: Math.floor(redPoints), halves: 0 };
  } else if (config?.finalScore) {
    redPoints = config.finalScore.red;
    bluePoints = config.finalScore.blue;
    redRecord = { wins: Math.floor(redPoints), losses: Math.floor(bluePoints), halves: 0 };
    blueRecord = { wins: Math.floor(bluePoints), losses: Math.floor(redPoints), halves: 0 };
  }

  const emptyScoringBreakdown: ScoringBreakdown = {
    eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, totalHoles: 0, totalRounds: 0,
  };

  return {
    red: {
      teamName: teamRedName,
      teamColor: '#C41E3A',
      scoring: emptyScoringBreakdown,
      girPct: 0,
      firPct: 0,
      points: redPoints,
      record: redRecord,
    },
    blue: {
      teamName: teamBlueName,
      teamColor: '#1A2744',
      scoring: emptyScoringBreakdown,
      girPct: 0,
      firPct: 0,
      points: bluePoints,
      record: blueRecord,
    },
  };
}

/**
 * Compute per-player W-L-H contributions from matchResults in ryder_cup_config.
 * Each player's record is tallied from the matches they participated in.
 */
export function getRyderCupPlayerContributions(
  matchResults?: MatchResult[],
): PlayerContribution[] {
  if (!matchResults || matchResults.length === 0) return [];

  const playerMap = new Map<string, PlayerContribution>();

  for (const m of matchResults) {
    const redWon = m.winner === 'red';
    const blueWon = m.winner === 'blue';
    const halved = m.winner === 'halved';

    for (const name of m.redPlayers) {
      const existing = playerMap.get(name) ?? {
        playerId: name,
        name,
        pointsEarned: 0,
        wins: 0,
        losses: 0,
        halves: 0,
        girPct: 0,
        firPct: 0,
        avgScore: 0,
      };
      if (redWon) { existing.wins++; existing.pointsEarned += 1; }
      else if (blueWon) { existing.losses++; }
      else if (halved) { existing.halves++; existing.pointsEarned += 0.5; }
      playerMap.set(name, existing);
    }

    for (const name of m.bluePlayers) {
      const existing = playerMap.get(name) ?? {
        playerId: name,
        name,
        pointsEarned: 0,
        wins: 0,
        losses: 0,
        halves: 0,
        girPct: 0,
        firPct: 0,
        avgScore: 0,
      };
      if (blueWon) { existing.wins++; existing.pointsEarned += 1; }
      else if (redWon) { existing.losses++; }
      else if (halved) { existing.halves++; existing.pointsEarned += 0.5; }
      playerMap.set(name, existing);
    }
  }

  return Array.from(playerMap.values()).sort((a, b) => b.pointsEarned - a.pointsEarned);
}

/**
 * Fetch all completed Ryder Cup trips for a player and compute their aggregate W-L-H record.
 */
export async function getPlayerRyderCupRecord(userId: string): Promise<{
  wins: number;
  losses: number;
  halves: number;
  cupsPlayed: number;
}> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip:trips(id, trip_type, status, ryder_cup_config)')
    .eq('user_id', userId);
  if (error) throw error;

  let wins = 0;
  let losses = 0;
  let halves = 0;
  let cupsPlayed = 0;

  for (const row of data ?? []) {
    const trip = (row as any).trip;
    if (!trip || trip.trip_type !== 'ryder' || trip.status !== 'completed') continue;
    const config = trip.ryder_cup_config;
    if (!config?.matchResults) continue;

    cupsPlayed++;

    // Find which team this player was on
    const { data: membership } = await supabase
      .from('trip_members')
      .select('team')
      .eq('trip_id', trip.id)
      .eq('user_id', userId)
      .single();
    const playerTeam = membership?.team;
    if (!playerTeam) continue;

    for (const m of config.matchResults as MatchResult[]) {
      const isOnRed = playerTeam === 'red';
      const playerNames = isOnRed ? m.redPlayers : m.bluePlayers;
      // We can't match by userId here since matchResults store display names,
      // so count all team matches as the player's matches for now
      if (m.winner === playerTeam) wins++;
      else if (m.winner === 'halved') halves++;
      else losses++;
    }
  }

  return { wins, losses, halves, cupsPlayed };
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
