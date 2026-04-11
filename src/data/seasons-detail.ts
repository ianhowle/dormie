// FedEx Cup-style season computation
// Future: wire totals to Supabase `season_standings` and `round_results` tables

// ─── Match Play Bracket Types ────────────────────────────────────────

export type BracketSize = 4 | 8 | 16 | 32;
export type BracketSeedingMethod = 'handicap' | 'qualifying' | 'random';
export type BracketFormat = 'single' | 'double';
export type BracketMatchLength = '9' | '18';
export type BracketHandicapStrokes = 'full' | 'reduced' | 'none';
export type BracketScoringMethod = 'match_play' | 'stableford' | 'stroke_play';
export type BracketMatchStatus = 'pending' | 'in_progress' | 'completed' | 'bye';

export type BracketConfig = {
  size: BracketSize;
  seeding_method: BracketSeedingMethod;
  format: BracketFormat;
  match_length: BracketMatchLength;
  handicap_strokes: BracketHandicapStrokes;
  scoring_method: BracketScoringMethod;
  round_deadline_days: number;
};

export type BracketMatch = {
  id: string;
  season_id: string;
  round: number;
  position: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
  player1_seed: number | null;
  player2_seed: number | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  status: BracketMatchStatus;
  deadline: string | null;
  is_losers_bracket?: boolean;
};

/**
 * Number of rounds required for a given bracket size.
 */
export function getBracketRounds(size: BracketSize): number {
  return Math.log2(size);
}

/**
 * Get round label for a given round number and total rounds.
 */
export function getBracketRoundLabel(round: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - round;
  if (roundsFromEnd === 0) return 'Final';
  if (roundsFromEnd === 1) return 'Semifinals';
  if (roundsFromEnd === 2) return 'Quarterfinals';
  return `Round of ${Math.pow(2, roundsFromEnd + 1)}`;
}

/**
 * Generate initial bracket matches with seeding.
 * Standard bracket seeding: 1v8, 4v5, 2v7, 3v6 for 8 players (ensures
 * top seeds are on opposite sides of the bracket).
 */
export function generateBracketMatches(
  size: BracketSize,
  players: { id: string; name: string; seed: number }[],
): BracketMatch[] {
  const totalRounds = getBracketRounds(size);
  const firstRoundMatchCount = size / 2;
  const matches: BracketMatch[] = [];

  // Standard seeding order for first round
  const seedOrder = generateSeedOrder(size);

  // First round matches
  for (let i = 0; i < firstRoundMatchCount; i++) {
    const seed1 = seedOrder[i * 2];
    const seed2 = seedOrder[i * 2 + 1];
    const p1 = players.find((p) => p.seed === seed1) ?? null;
    const p2 = players.find((p) => p.seed === seed2) ?? null;

    const isBye = !p1 || !p2;
    matches.push({
      id: `r1_m${i + 1}`,
      season_id: '',
      round: 1,
      position: i + 1,
      player1_id: p1?.id ?? null,
      player2_id: p2?.id ?? null,
      player1_name: p1?.name ?? null,
      player2_name: p2?.name ?? null,
      player1_seed: p1?.seed ?? null,
      player2_seed: p2?.seed ?? null,
      player1_score: null,
      player2_score: null,
      winner_id: isBye ? (p1?.id ?? p2?.id ?? null) : null,
      status: isBye ? 'bye' : 'pending',
      deadline: null,
    });
  }

  // Subsequent rounds (empty matches — filled as winners advance)
  for (let r = 2; r <= totalRounds; r++) {
    const matchCount = size / Math.pow(2, r);
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `r${r}_m${i + 1}`,
        season_id: '',
        round: r,
        position: i + 1,
        player1_id: null,
        player2_id: null,
        player1_name: null,
        player2_name: null,
        player1_seed: null,
        player2_seed: null,
        player1_score: null,
        player2_score: null,
        winner_id: null,
        status: 'pending',
        deadline: null,
      });
    }
  }

  return matches;
}

/**
 * Generate standard bracket seeding order.
 * Ensures 1v(size), 2v(size-1), etc. with proper bracket placement
 * so top seeds meet as late as possible.
 */
function generateSeedOrder(size: number): number[] {
  if (size === 2) return [1, 2];
  const half = generateSeedOrder(size / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed, size + 1 - seed);
  }
  return result;
}

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

// ─── Weekly Side Games ───────────────────────────────────────────────

export type WeeklySideGameType =
  | 'closest_to_pin'
  | 'longest_drive'
  | 'most_birdies'
  | 'low_round'
  | 'most_improved'
  | 'fewest_putts'
  | 'sandbagger'
  | 'custom';

export type WeeklySideGame = {
  id: string;
  week_id: string;
  type: WeeklySideGameType;
  label: string;
  description: string;
  points: number;
  hole_number: number | null;
  winner_user_id: string | null;
  winner_name: string | null;
  created_at: string;
};

export const SIDE_GAME_TYPE_CONFIG: Record<
  WeeklySideGameType,
  { label: string; description: string; needsHole: boolean; emoji: string }
> = {
  closest_to_pin: {
    label: 'Closest to Pin',
    description: 'Closest tee shot to the pin on a par 3',
    needsHole: true,
    emoji: '\uD83C\uDFAF',
  },
  longest_drive: {
    label: 'Longest Drive',
    description: 'Longest drive in the fairway',
    needsHole: true,
    emoji: '\uD83D\uDCA8',
  },
  most_birdies: {
    label: 'Most Birdies',
    description: 'Player with the most birdies this week',
    needsHole: false,
    emoji: '\uD83D\uDC26',
  },
  low_round: {
    label: 'Low Round',
    description: 'Lowest gross score (separate from position points)',
    needsHole: false,
    emoji: '\uD83C\uDFC6',
  },
  most_improved: {
    label: 'Most Improved',
    description: 'Player who most exceeds their scoring average',
    needsHole: false,
    emoji: '\uD83D\uDCC8',
  },
  fewest_putts: {
    label: 'Fewest Putts',
    description: 'Player with the fewest total putts',
    needsHole: false,
    emoji: '\u26F3',
  },
  sandbagger: {
    label: 'Sandbagger Alert',
    description: 'Player who most outperforms their handicap',
    needsHole: false,
    emoji: '\uD83D\uDC40',
  },
  custom: {
    label: 'Custom',
    description: 'Commissioner-defined side game',
    needsHole: false,
    emoji: '\u2B50',
  },
};

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

// ─── Multi-Round Week & Participation Bonus ─────────────────────────

export type MultiRoundConfig = {
  multiRoundWeek: boolean;
  roundsAllowedPerWeek: number;
  bestRoundsCount: number;
};

export type ParticipationConfig = {
  participationBonus: boolean;
  participationPoints: number;
};

/**
 * Given all round points a player logged in a single week, return the
 * weekly total respecting "best X of Y" and participation bonus rules.
 *
 * @param roundPoints   Array of points earned per round this week (may be empty)
 * @param multiRound    Multi-round configuration (null/undefined = single round)
 * @param participation Participation bonus configuration (null/undefined = none)
 */
export function calculateWeeklyPoints(
  roundPoints: number[],
  multiRound?: MultiRoundConfig | null,
  participation?: ParticipationConfig | null,
): { total: number; countingRounds: number[]; droppedRounds: number[]; participationAwarded: boolean } {
  if (roundPoints.length === 0) {
    return { total: 0, countingRounds: [], droppedRounds: [], participationAwarded: false };
  }

  // Sort descending to pick best rounds
  const sorted = [...roundPoints].sort((a, b) => b - a);

  let countingRounds: number[];
  let droppedRounds: number[];

  if (multiRound?.multiRoundWeek && multiRound.bestRoundsCount > 0) {
    const take = Math.min(multiRound.bestRoundsCount, sorted.length);
    countingRounds = sorted.slice(0, take);
    droppedRounds = sorted.slice(take);
  } else {
    // Single round mode — take the best one
    countingRounds = [sorted[0]];
    droppedRounds = sorted.slice(1);
  }

  let total = countingRounds.reduce((sum, pts) => sum + pts, 0);

  // Participation bonus: awarded if player logged at least 1 round
  const participationAwarded = !!(participation?.participationBonus && roundPoints.length > 0);
  if (participationAwarded) {
    total += participation!.participationPoints;
  }

  return { total, countingRounds, droppedRounds, participationAwarded };
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

// ─── Bracket Match Progression ──────────────────────────────────────

/**
 * Record a player's score for a bracket match.
 * Sets the score on the correct player slot and updates status to in_progress.
 * Returns the updated matches array.
 */
export function recordBracketScore(
  matches: BracketMatch[],
  matchId: string,
  playerId: string,
  score: number,
): BracketMatch[] {
  return matches.map((m) => {
    if (m.id !== matchId) return m;
    const updated = { ...m, status: 'in_progress' as BracketMatchStatus };
    if (m.player1_id === playerId) {
      updated.player1_score = score;
    } else if (m.player2_id === playerId) {
      updated.player2_score = score;
    }
    return updated;
  });
}

/**
 * Check if both players in a match have submitted scores.
 */
export function isBracketMatchReady(match: BracketMatch): boolean {
  return (
    match.player1_score != null &&
    match.player2_score != null &&
    match.player1_id != null &&
    match.player2_id != null
  );
}

/**
 * Resolve a bracket match: determine the winner based on scoring method.
 *
 * For 'stableford' (Net Stableford): higher score wins (more points = better).
 * For 'match_play': higher score wins (holes won).
 * For 'stroke_play': lower score wins (fewer strokes = better).
 *
 * Returns the updated match with winner_id set and status = 'completed'.
 */
export function resolveBracketMatch(
  match: BracketMatch,
  scoringMethod: BracketScoringMethod,
): BracketMatch {
  if (!isBracketMatchReady(match)) return match;

  const s1 = match.player1_score!;
  const s2 = match.player2_score!;

  let winnerId: string;
  if (scoringMethod === 'stroke_play') {
    // Lower is better for stroke play
    winnerId = s1 <= s2 ? match.player1_id! : match.player2_id!;
  } else {
    // Higher is better for stableford and match_play (holes won)
    winnerId = s1 >= s2 ? match.player1_id! : match.player2_id!;
  }

  return {
    ...match,
    winner_id: winnerId,
    status: 'completed',
  };
}

/**
 * Advance a match winner to the next round of the bracket.
 * The winner of match at position P in round R feeds into position ceil(P/2)
 * in round R+1, filling player1 for odd positions and player2 for even.
 *
 * Returns the updated full matches array.
 */
export function advanceBracketWinner(
  matches: BracketMatch[],
  completedMatch: BracketMatch,
): BracketMatch[] {
  if (!completedMatch.winner_id || completedMatch.status !== 'completed') {
    return matches;
  }

  const nextRound = completedMatch.round + 1;
  const nextPosition = Math.ceil(completedMatch.position / 2);
  const isPlayer1Slot = completedMatch.position % 2 === 1;

  const winnerName = completedMatch.winner_id === completedMatch.player1_id
    ? completedMatch.player1_name
    : completedMatch.player2_name;
  const winnerSeed = completedMatch.winner_id === completedMatch.player1_id
    ? completedMatch.player1_seed
    : completedMatch.player2_seed;

  return matches.map((m) => {
    if (m.round !== nextRound || m.position !== nextPosition) return m;
    const updated = { ...m };
    if (isPlayer1Slot) {
      updated.player1_id = completedMatch.winner_id;
      updated.player1_name = winnerName;
      updated.player1_seed = winnerSeed;
    } else {
      updated.player2_id = completedMatch.winner_id;
      updated.player2_name = winnerName;
      updated.player2_seed = winnerSeed;
    }
    return updated;
  });
}

/**
 * Full bracket progression pipeline: record score, resolve if ready, advance winner.
 * Returns { matches, resolvedMatch, isChampion }.
 */
export function processBracketRound(
  matches: BracketMatch[],
  matchId: string,
  playerId: string,
  score: number,
  scoringMethod: BracketScoringMethod,
  bracketSize: BracketSize,
): { matches: BracketMatch[]; resolvedMatch: BracketMatch | null; isChampion: boolean } {
  let updated = recordBracketScore(matches, matchId, playerId, score);

  const match = updated.find((m) => m.id === matchId);
  if (!match || !isBracketMatchReady(match)) {
    return { matches: updated, resolvedMatch: null, isChampion: false };
  }

  const resolved = resolveBracketMatch(match, scoringMethod);
  updated = updated.map((m) => (m.id === resolved.id ? resolved : m));

  const totalRounds = getBracketRounds(bracketSize);
  const isFinal = resolved.round === totalRounds;

  if (!isFinal) {
    updated = advanceBracketWinner(updated, resolved);
  }

  return { matches: updated, resolvedMatch: resolved, isChampion: isFinal };
}

/**
 * Get the display status of a bracket match for UI.
 */
export function getBracketMatchStatus(match: BracketMatch): string {
  if (match.status === 'completed') return 'Complete';
  if (match.status === 'bye') return 'BYE';
  if (match.player1_id == null || match.player2_id == null) return 'Awaiting Players';
  if (match.player1_score != null && match.player2_score == null) return 'Waiting for Opponent';
  if (match.player1_score == null && match.player2_score != null) return 'Waiting for Opponent';
  if (match.status === 'in_progress') return 'In Progress';
  return 'Awaiting Scores';
}

/**
 * Find which match a player is currently in (their active/pending match).
 */
export function findPlayerCurrentMatch(
  matches: BracketMatch[],
  playerId: string,
): BracketMatch | null {
  // First, check for in_progress matches
  const inProgress = matches.find(
    (m) =>
      m.status === 'in_progress' &&
      (m.player1_id === playerId || m.player2_id === playerId),
  );
  if (inProgress) return inProgress;

  // Then check for pending matches
  const pending = matches.find(
    (m) =>
      m.status === 'pending' &&
      (m.player1_id === playerId || m.player2_id === playerId),
  );
  return pending ?? null;
}

/**
 * Check if the bracket is fully complete (all matches resolved).
 */
export function isBracketComplete(matches: BracketMatch[], bracketSize: BracketSize): boolean {
  const totalRounds = getBracketRounds(bracketSize);
  const finalMatch = matches.find((m) => m.round === totalRounds && m.position === 1);
  return finalMatch?.status === 'completed' && finalMatch.winner_id != null;
}

/**
 * Get the bracket champion (winner of the final match).
 */
export function getBracketChampion(
  matches: BracketMatch[],
  bracketSize: BracketSize,
): { id: string; name: string; seed: number } | null {
  const totalRounds = getBracketRounds(bracketSize);
  const finalMatch = matches.find((m) => m.round === totalRounds && m.position === 1);
  if (!finalMatch || finalMatch.status !== 'completed' || !finalMatch.winner_id) return null;

  if (finalMatch.winner_id === finalMatch.player1_id) {
    return {
      id: finalMatch.player1_id!,
      name: finalMatch.player1_name ?? 'Unknown',
      seed: finalMatch.player1_seed ?? 0,
    };
  }
  return {
    id: finalMatch.player2_id!,
    name: finalMatch.player2_name ?? 'Unknown',
    seed: finalMatch.player2_seed ?? 0,
  };
}
