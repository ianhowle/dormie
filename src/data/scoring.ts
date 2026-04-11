export type ScoringFormat =
  | 'stroke_play'
  | 'match_play'
  | 'stableford'
  | 'modified_stableford'
  | 'best_ball'
  | 'scramble'
  | 'alternate_shot'
  | 'shamble'
  | 'chapman'
  | 'fourball'
  | 'greensomes'
  | 'pinehurst'
  | 'wolf';

export type SideGame =
  | 'nassau'
  | 'skins'
  | 'wolf'
  | 'dots'
  | 'bingo_bango_bongo'
  | 'snake'
  | 'trash'
  | 'sandies'
  | 'greenies'
  | 'arnies'
  | 'hogans'
  | 'murphys'
  | 'poleys'
  | 'bark'
  | 'close_shave'
  | 'hammer';

export type TrackingLevel = 'basic' | 'standard' | 'detailed';
export type RoundType = 'casual' | 'competitive' | 'matchup';
export type HoleRange = 'front9' | 'back9' | 'full18';
export type ScoreMode = 'gross' | 'net';

// ─── Format config (ordered for pill display) ────────────────────────
export type FormatInfo = {
  key: ScoringFormat;
  label: string;
  description: string;
};

export const SCORING_FORMATS: FormatInfo[] = [
  { key: 'stroke_play', label: 'Total Strokes', description: 'Lowest total score wins' },
  { key: 'stableford', label: 'Stableford', description: 'Points awarded relative to par on each hole' },
  { key: 'modified_stableford', label: 'Mod. Stableford', description: 'Aggressive points: bonus for birdies, penalty for bogeys' },
  { key: 'match_play', label: 'Match Play', description: 'Win individual holes; most holes won takes the match' },
  { key: 'best_ball', label: 'Best Ball', description: 'Teams use the lowest score on each hole' },
  { key: 'scramble', label: 'Scramble', description: 'Everyone plays from the best shot each time' },
  { key: 'wolf', label: 'Wolf', description: 'Rotating picker chooses partners or goes alone each hole' },
  { key: 'shamble', label: 'Shamble', description: 'Best drive, then everyone plays their own ball' },
  { key: 'fourball', label: 'Four-Ball', description: 'Two-person teams; best individual score counts' },
];

// ─── Side games (ordered for pill display) ───────────────────────────
export type SideGameInfo = {
  key: SideGame;
  label: string;
};

export const SIDE_GAMES: SideGameInfo[] = [
  { key: 'dots', label: 'Dots' },
  { key: 'snake', label: 'Snake' },
  { key: 'greenies', label: 'Greenies' },
  { key: 'skins', label: 'Skins' },
  { key: 'hammer', label: 'Hammer' },
  { key: 'nassau', label: 'Nassau' },
  { key: 'wolf', label: 'Wolf' },
  { key: 'bingo_bango_bongo', label: 'Bingo Bango Bongo' },
  { key: 'sandies', label: 'Sandies' },
  { key: 'bark', label: 'Barkies' },
  { key: 'arnies', label: 'Arnies' },
  { key: 'close_shave', label: 'KP' },
];

// Legacy label maps (kept for compatibility)
export const FORMAT_LABELS: Record<ScoringFormat, string> = {
  stroke_play: 'Stroke Play',
  match_play: 'Match Play',
  stableford: 'Stableford',
  modified_stableford: 'Modified Stableford',
  best_ball: 'Best Ball',
  scramble: 'Scramble',
  alternate_shot: 'Alternate Shot',
  shamble: 'Shamble',
  chapman: 'Chapman',
  fourball: 'Four-Ball',
  greensomes: 'Greensomes',
  pinehurst: 'Pinehurst',
  wolf: 'Wolf',
};

export const SIDE_GAME_LABELS: Record<SideGame, string> = {
  nassau: 'Nassau',
  skins: 'Skins',
  wolf: 'Wolf',
  dots: 'Dots',
  bingo_bango_bongo: 'Bingo Bango Bongo',
  snake: 'Snake',
  trash: 'Trash',
  sandies: 'Sandies',
  greenies: 'Greenies',
  arnies: 'Arnies',
  hogans: 'Hogans',
  murphys: 'Murphys',
  poleys: 'Poleys',
  bark: 'Bark',
  close_shave: 'Close Shave',
  hammer: 'Hammer',
};

export function calculateStablefordPoints(score: number, par: number, handicapStrokes: number): number {
  const netScore = score - handicapStrokes;
  const diff = netScore - par;
  if (diff >= 2) return 0;
  if (diff === 1) return 1;
  if (diff === 0) return 2;
  if (diff === -1) return 3;
  if (diff === -2) return 4;
  return 5; // double eagle or better
}

/**
 * Calculate Modified Stableford points for a single hole.
 * Uses an aggressive scale rewarding birdies/eagles and penalizing bogeys.
 *
 * Scale:
 *   Albatross or better = +8
 *   Eagle               = +5
 *   Birdie              = +2
 *   Par                 =  0
 *   Bogey               = -1
 *   Double bogey        = -3
 *   Triple+             = -5
 */
export function calculateModifiedStablefordPoints(score: number, par: number, handicapStrokes: number): number {
  const netScore = score - handicapStrokes;
  const diff = netScore - par;
  if (diff <= -3) return 8;  // Albatross or better
  if (diff === -2) return 5; // Eagle
  if (diff === -1) return 2; // Birdie
  if (diff === 0) return 0;  // Par
  if (diff === 1) return -1; // Bogey
  if (diff === 2) return -3; // Double bogey
  return -5;                 // Triple bogey or worse
}

/**
 * Calculate Modified Stableford points for a full round.
 */
export function calculateModifiedStablefordFromRound(
  holeScores: number[],
  coursePars: number[],
  handicapStrokesPerHole?: number[],
): number {
  const len = Math.min(holeScores.length, coursePars.length);
  let total = 0;
  for (let i = 0; i < len; i++) {
    const hcpStrokes = handicapStrokesPerHole?.[i] ?? 0;
    total += calculateModifiedStablefordPoints(holeScores[i], coursePars[i], hcpStrokes);
  }
  return total;
}

/**
 * Select the best N holes from a set of Stableford points.
 * Used for Best 9, Best 6, etc. scoring formats.
 *
 * @param holePoints  Array of per-hole Stableford points (length 9 or 18)
 * @param bestCount   Number of best holes to select (e.g. 9)
 * @returns           { total, selectedIndices } — sum and 0-based hole indices chosen
 */
export function calculateBestNHoles(
  holePoints: number[],
  bestCount: number,
): { total: number; selectedIndices: number[] } {
  const indexed = holePoints.map((pts, i) => ({ pts, idx: i }));
  indexed.sort((a, b) => b.pts - a.pts);
  const selected = indexed.slice(0, bestCount);
  const total = selected.reduce((sum, s) => sum + s.pts, 0);
  const selectedIndices = selected.map((s) => s.idx).sort((a, b) => a - b);
  return { total, selectedIndices };
}

// ─── Match Play ──────────────────────────────────────────────────────

export type MatchPlayHoleResult = 'A' | 'B' | 'halved';
export type MatchPlayResult = {
  holesWonA: number;
  holesWonB: number;
  holesHalved: number;
  holeResults: MatchPlayHoleResult[];
  /** e.g. "2&1", "1 UP", "AS" (All Square), "HALVED" */
  result: string;
  /** Which player won, or null for halved */
  winner: 'A' | 'B' | null;
  /** Hole number where match ended (early close-out), or total holes if went to end */
  matchEndedAtHole: number;
};

/**
 * Calculate Match Play result for two players over N holes.
 * Match ends early when one player leads by more than holes remaining.
 */
export function calculateMatchPlay(
  playerAScores: number[],
  playerBScores: number[],
): MatchPlayResult {
  const totalHoles = Math.min(playerAScores.length, playerBScores.length);
  let holesWonA = 0;
  let holesWonB = 0;
  let holesHalved = 0;
  const holeResults: MatchPlayHoleResult[] = [];
  let matchEndedAtHole = totalHoles;

  for (let i = 0; i < totalHoles; i++) {
    if (playerAScores[i] < playerBScores[i]) {
      holesWonA++;
      holeResults.push('A');
    } else if (playerBScores[i] < playerAScores[i]) {
      holesWonB++;
      holeResults.push('B');
    } else {
      holesHalved++;
      holeResults.push('halved');
    }

    // Check if match is mathematically decided
    const lead = Math.abs(holesWonA - holesWonB);
    const holesRemaining = totalHoles - (i + 1);
    if (lead > holesRemaining && holesRemaining >= 0) {
      matchEndedAtHole = i + 1;
      break;
    }
  }

  const finalDiff = holesWonA - holesWonB;
  const holesRemaining = totalHoles - matchEndedAtHole;
  let result: string;
  let winner: 'A' | 'B' | null = null;

  if (finalDiff === 0) {
    result = matchEndedAtHole === totalHoles ? 'HALVED' : 'AS';
  } else {
    const lead = Math.abs(finalDiff);
    winner = finalDiff > 0 ? 'A' : 'B';
    if (holesRemaining === 0) {
      // Won on the final hole
      result = `${lead} UP`;
    } else {
      result = `${lead}&${holesRemaining}`;
    }
  }

  return { holesWonA, holesWonB, holesHalved, holeResults, result, winner, matchEndedAtHole };
}

// ─── Best Ball (team) ────────────────────────────────────────────────

export type BestBallResult = {
  teamScorePerHole: number[];
  teamTotal: number;
};

/**
 * Calculate Best Ball team score: take the best (lowest) individual score per hole.
 * Each inner array is one player's scores for all holes.
 */
export function calculateBestBall(playerScores: number[][]): BestBallResult {
  if (playerScores.length === 0) return { teamScorePerHole: [], teamTotal: 0 };
  const numHoles = playerScores[0].length;
  const teamScorePerHole: number[] = [];

  for (let h = 0; h < numHoles; h++) {
    let best = Infinity;
    for (const scores of playerScores) {
      if (h < scores.length && scores[h] < best) {
        best = scores[h];
      }
    }
    teamScorePerHole.push(best === Infinity ? 0 : best);
  }

  const teamTotal = teamScorePerHole.reduce((sum, s) => sum + s, 0);
  return { teamScorePerHole, teamTotal };
}

// ─── Scramble ────────────────────────────────────────────────────────

/**
 * Calculate Scramble team score.
 * In a scramble, the team selects the best shot each time,
 * resulting in a single team score per hole.
 * This function validates that a scramble score is recorded correctly:
 * the team score per hole should be <= the best individual score per hole.
 */
export function calculateScrambleTeamScore(
  teamScoresPerHole: number[],
): { teamTotal: number } {
  const teamTotal = teamScoresPerHole.reduce((sum, s) => sum + s, 0);
  return { teamTotal };
}

/**
 * Validate scramble: team score per hole must be <= best individual score.
 */
export function validateScrambleScore(
  teamScoresPerHole: number[],
  individualScoresPerHole: number[][],
): { valid: boolean; violations: number[] } {
  const violations: number[] = [];
  for (let h = 0; h < teamScoresPerHole.length; h++) {
    let bestIndividual = Infinity;
    for (const scores of individualScoresPerHole) {
      if (h < scores.length && scores[h] < bestIndividual) {
        bestIndividual = scores[h];
      }
    }
    if (teamScoresPerHole[h] > bestIndividual && bestIndividual < Infinity) {
      violations.push(h);
    }
  }
  return { valid: violations.length === 0, violations };
}

// ─── Chapman / Pinehurst ─────────────────────────────────────────────

export type ChapmanHoleScore = {
  /** Player A's drive */
  driveA: number;
  /** Player B's drive */
  driveB: number;
  /** Player A hits B's drive (second shot) */
  secondShotA: number;
  /** Player B hits A's drive (second shot) */
  secondShotB: number;
  /** Which ball was selected after second shots: 'A' (A's drive, hit by B) or 'B' (B's drive, hit by A) */
  selectedBall: 'A' | 'B';
  /** Remaining alternate shots to hole out (total strokes from 3rd shot onward) */
  alternateShots: number;
};

/**
 * Calculate Chapman (Pinehurst) team score for a single hole.
 * Both players drive → swap and hit partner's ball → select best ball → alternate to finish.
 * Total = 2 (drives) + 2 (second shots on selected ball) ... wait, let me reconsider.
 * Actually: drive (1) + partner's second shot on that ball (1) + alternate shots to finish.
 * Total strokes = 2 (drive + second shot) + alternateShots.
 */
export function calculateChapmanHoleScore(hole: ChapmanHoleScore): number {
  // The score is: 1 (drive) + 1 (partner's second shot) + remaining alternate shots
  return 2 + hole.alternateShots;
}

/**
 * Calculate Chapman team total for a round.
 */
export function calculateChapmanTotal(holes: ChapmanHoleScore[]): {
  perHoleScores: number[];
  total: number;
} {
  const perHoleScores = holes.map(calculateChapmanHoleScore);
  const total = perHoleScores.reduce((sum, s) => sum + s, 0);
  return { perHoleScores, total };
}
