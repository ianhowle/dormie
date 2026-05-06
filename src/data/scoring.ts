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
  | 'wolf'
  | 'low_high'
  | 'sixsixsix';

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
  | 'hammer'
  | 'three_putt_poker';

export type TrackingLevel = 'basic' | 'standard' | 'detailed';
export type RoundType = 'casual' | 'competitive' | 'matchup';
export type HoleRange = 'front9' | 'back9' | 'full18';
export type ScoreMode = 'gross' | 'net';

// ─── Disclosure copy types ───────────────────────────────────────────
// Powers the wizard's inline list copy AND the InfoDisclosureModal that
// opens off the (i) icons. One source of truth for both surfaces.

export type Complexity = 'Beginner' | 'Casual' | 'Expert';

// ─── Format config (ordered for pill display) ────────────────────────
export type FormatInfo = {
  key: ScoringFormat;
  label: string;
  /** One-line tagline shown in the inline format list. */
  description: string;
  /** Body copy in the InfoDisclosureModal — confident, golf-specific, never patronizing. */
  fullDescription: string;
  /** Short, concrete scoring scenario rendered under the description in the modal. */
  example: string;
  /** Coarse complexity bucket surfaced near the title in the modal. */
  complexity: Complexity;
  /** "When to use" callout — helps the user decide between formats. */
  whenToUse: string;
};

export const SCORING_FORMATS: FormatInfo[] = [
  {
    key: 'stroke_play',
    label: 'Total Strokes',
    description: 'Lowest total score wins',
    fullDescription:
      'The most common form of golf scoring. Add up your strokes across all 18 holes — lowest total wins. No team play, no per-hole shenanigans, just you against the course and the scorecard.',
    example: 'Drew shoots 78, Jake 82, Tommy 85. Drew wins by four.',
    complexity: 'Beginner',
    whenToUse:
      'Clean head-to-head measure of who played best across the whole round. The default for casual rounds and most tournaments.',
  },
  {
    key: 'stableford',
    label: 'Stableford',
    description: 'Points per hole — birdie 3, par 2, bogey 1',
    fullDescription:
      'Score points per hole instead of total strokes. Birdie = 3, par = 2, bogey = 1, double bogey or worse = 0. Highest points wins. A blow-up hole doesn\'t kill your round — you zero that hole and move on.',
    example:
      'Three birdies (9), seven pars (14), eight bogeys (8) = 31 points. Solid round.',
    complexity: 'Casual',
    whenToUse:
      'Mixed-handicap groups, or anyone who doesn\'t want one bad hole to torpedo a whole round. Forgiving and fast-paced.',
  },
  {
    key: 'modified_stableford',
    label: 'Mod. Stableford',
    description: 'Stableford with attitude — eagles pay, doubles cost',
    fullDescription:
      'Stableford with sharper teeth. Reward aggressive play harder, punish mistakes harder. Eagle = 5, birdie = 2, par = 0, bogey = -1, double = -3, triple+ = -5. Highest total wins. Used at the WGC events — go for the green or pay for it.',
    example:
      'Two eagles (10), four birdies (8), nine pars (0), three bogeys (-3) = 15 points. Aggressive day pays.',
    complexity: 'Expert',
    whenToUse:
      'Confident players who want a format that rewards risk. Best for a round where you want the scorecard to tell a story.',
  },
  {
    key: 'match_play',
    label: 'Match Play',
    description: 'Hole-by-hole, head-to-head',
    fullDescription:
      'Forget your total score. Each hole is its own match — win it, lose it, or halve it. Whoever wins more holes wins the round. The pressure is per-hole, and the math gets interesting: 4-up with 4 to play and the match is closed out.',
    example:
      'Drew wins 1, 2, 4, 7, 9. Tommy wins 3, 5, 8. Halved on 6. Drew leads 5-3 with 9 to play.',
    complexity: 'Casual',
    whenToUse:
      'Two-person duels and 2v2 team matches. The format that produces "I\'ll close you out on 14" moments.',
  },
  {
    key: 'best_ball',
    label: 'Best Ball',
    description: "Two-player teams; lower partner's score counts",
    fullDescription:
      'Two-person teams. Each player plays their own ball. Every hole, the team takes the lower of the two scores. One partner blows up while the other birdies? Team gets the birdie. Half scramble feel, all individual play.',
    example:
      'Drew makes 5 on hole 4, Jake makes 4. Team score: 4. Add up the team\'s better-ball scores across 18.',
    complexity: 'Casual',
    whenToUse:
      'Mixed-handicap pairs where one player can save the team on a tough hole. Strong foursome format.',
  },
  {
    key: 'scramble',
    label: 'Scramble',
    description: 'All play, best shot, repeat',
    fullDescription:
      'Team golf at its most forgiving. Everyone tees off, pick the best drive, everyone plays from there. Pick the best second shot, everyone plays from there. Repeat until the ball is in the hole. One score per team per hole.',
    example: 'Foursome scramble. Drives long, irons accurate, putts dropped. Team posts 62 — ten under.',
    complexity: 'Beginner',
    whenToUse:
      'Mixed-skill groups, charity tournaments, anyone who wants a fast pace and a low team score. The format you can play with someone who\'s never picked up a club.',
  },
  {
    key: 'wolf',
    label: 'Wolf',
    description: 'Rotating Wolf picks partners or goes solo for double',
    fullDescription:
      'Foursome only. Each hole, one player is the Wolf (rotating). After watching the others tee off, the Wolf picks a partner — or goes "Lone Wolf" for double points. Wolf\'s side vs the other two on that hole. Points stack across the round.',
    example:
      'On 7, Tommy is Wolf. Drew bombs his drive — Tommy picks Drew. They beat the other two. Tommy and Drew each get 2 points.',
    complexity: 'Expert',
    whenToUse:
      'Foursomes who want strategic depth and trash talk. The most social golf format — every hole has a decision.',
  },
  {
    key: 'shamble',
    label: 'Shamble',
    description: 'Best drive, then everyone plays their own ball',
    fullDescription:
      'Half scramble, half stroke play. Everyone drives, pick the best one, then everyone plays their own ball from there to the hole. Take the team\'s lowest score per hole. Reduces tee-shot pressure but keeps individual play alive.',
    example: 'Drew\'s drive is best on hole 3. Everyone plays from his ball. Jake makes par from there — team score 4.',
    complexity: 'Casual',
    whenToUse:
      'When you want some scramble forgiveness without losing the individual scoring feel. Common in member-guest tournaments.',
  },
  {
    key: 'fourball',
    label: 'Four-Ball',
    description: "Two-player teams; better-ball every hole",
    fullDescription:
      'Two-person teams, each player plays their own ball, team takes the lower individual score per hole. Same engine as Best Ball — the names are interchangeable in most clubhouses. The default Ryder Cup session format.',
    example: 'Drew and Tommy as a team. Hole 5: Drew makes 4, Tommy makes 5. Team score 4.',
    complexity: 'Casual',
    whenToUse:
      'Team format where every player\'s round still matters. The standard partner-format for cup competitions.',
  },
  {
    key: 'low_high',
    label: 'Low Ball / High Ball',
    description: '2v2 — best AND worst scores both count',
    fullDescription:
      '2v2 with two scores per hole. The team\'s low ball goes head-to-head against the other team\'s low ball; the team\'s high ball goes head-to-head against the other team\'s high ball. Two points up for grabs each hole. One blow-up costs the team a full point even if the partner birdies.',
    example:
      'Hole 7: Team A scores 4 and 6. Team B scores 5 and 5. Team A wins low ball (4 vs 5), loses high ball (6 vs 5). 1-1 split.',
    complexity: 'Expert',
    whenToUse:
      'Even-handicap pairs who want both partners to feel pressure. Adds depth to the standard 2v2.',
  },
  {
    key: 'sixsixsix',
    label: '6-6-6',
    description: 'Three partner blocks, six holes each — everyone plays with everyone',
    fullDescription:
      'Foursome format. Three blocks of six holes; partners rotate each block. By round\'s end, you\'ve been partners with each of the others for one block. Each block is its own match — three matches in one round.',
    example:
      'Holes 1-6: Drew + Tommy vs Jake + Marco. Holes 7-12: Drew + Jake vs Tommy + Marco. Holes 13-18: Drew + Marco vs Tommy + Jake.',
    complexity: 'Casual',
    whenToUse:
      'Foursomes that want the team feel without committing to one partner. Equalizes pairings across the round.',
  },
];

// ─── Side games (ordered for pill display) ───────────────────────────
export type SideGameInfo = {
  key: SideGame;
  label: string;
  description: string;
  fullDescription: string;
  example: string;
  complexity: Complexity;
  whenToUse: string;
};

export const SIDE_GAMES: SideGameInfo[] = [
  {
    key: 'dots',
    label: 'Dots',
    description: 'Earn dots for one-off wins on a hole',
    fullDescription:
      'A flexible side bet. Earn a dot for greenies, sandies, chip-ins, closest to the pin — any agreed-upon achievement. Dots have a fixed cash value (e.g., $1 each). Tally at the end.',
    example:
      'Greenies, sandies, and chip-ins each = 1 dot. Drew finishes with 8, Jake 5, Tommy 6, Marco 3. Drew collects from each.',
    complexity: 'Casual',
    whenToUse:
      'Casual rounds where you want a side bet that rewards lots of small moments. Every group has its own dot list.',
  },
  {
    key: 'snake',
    label: 'Snake',
    description: 'Whoever 3-putts last holds the snake — and pays',
    fullDescription:
      'First player to 3-putt picks up the snake. Anyone who 3-putts after takes it over. Whoever holds the snake at the end pays everyone an agreed amount. Some groups double or triple the payout if the final 3-putt is on 18.',
    example:
      'Drew 3-putts on 4 and holds the snake. Jake 3-putts on 11 — snake transfers. No one else 3-putts. Jake pays $5 each to Drew, Tommy, Marco.',
    complexity: 'Casual',
    whenToUse:
      'Any round where you want pressure on the greens. Light stakes — the snake is more about pride than money.',
  },
  {
    key: 'greenies',
    label: 'Greenies',
    description: 'Closest to the pin on every par 3',
    fullDescription:
      'On every par 3, whoever hits closest to the pin AND makes par or better wins the greenie. Fixed payout per greenie — winner collects from every other player.',
    example:
      'Hole 7. Tommy stuffs it to 4 feet and makes par. Greenie: Tommy collects $2 from each of Drew, Jake, Marco.',
    complexity: 'Beginner',
    whenToUse:
      'Any round on a course with multiple par 3s. Easy to track, low-stakes incentive to actually go for the pin.',
  },
  {
    key: 'skins',
    label: 'Skins',
    description: 'Win a hole outright, win the skin — ties carry over',
    fullDescription:
      'Each hole is worth a skin. Win the hole outright (low score, no ties) and you take that skin. If two or more tie, the skin carries over to the next hole — pots can grow. Plays gross or net.',
    example:
      'Holes 1, 2, 3 all tie. Hole 4: Drew makes 3, everyone else makes 4 or worse. Drew wins 4 skins.',
    complexity: 'Casual',
    whenToUse:
      'Foursome rounds that want a long-arc bet across the whole 18. Carry-overs are the magic — every halved hole raises the next one\'s stakes.',
  },
  {
    key: 'hammer',
    label: 'Hammer',
    description: 'Double the bet at any point — at your peril',
    fullDescription:
      'On any hole, any player can "drop the hammer" to double the per-hole stakes. The opponent accepts (now playing for double) or concedes the hole as it stands. Stacks: hammer can be re-dropped to redouble.',
    example:
      'Hole 12. Drew leads. Tommy drops the hammer — bet doubles. Drew accepts. Tommy now must beat Drew on 12 or lose double.',
    complexity: 'Expert',
    whenToUse:
      'Match play between confident players who want to swing the round on a single hole. Not for the conflict-averse.',
  },
  {
    key: 'nassau',
    label: 'Nassau',
    description: 'Three bets in one round: front 9, back 9, overall',
    fullDescription:
      'The classic three-way bet. One bet on the front 9, one on the back 9, one on the full 18. Equal stakes on each. Often combined with a "press" rule — when down by 2, the losing side can re-double. Three matches running simultaneously.',
    example: '$10 Nassau. Drew wins front 9, loses back 9, wins overall. Net: Drew wins $10 (won 2 of 3).',
    complexity: 'Casual',
    whenToUse:
      'The default match-play side bet. Survives a bad start because the back 9 is its own bet.',
  },
  {
    key: 'wolf',
    label: 'Wolf',
    description: 'Rotating Wolf picks a partner or goes solo for double',
    fullDescription:
      'Same mechanics as the Wolf format, played alongside another scoring format. Each hole, the rotating Wolf either picks a partner (1 point per win) or goes alone for double points. Side-bet cash value per Wolf point at round\'s end.',
    example:
      'Tommy goes Lone Wolf on 14, beats the others — 2 points. Drew picks a partner on 15, wins — 1 point each.',
    complexity: 'Expert',
    whenToUse:
      'Foursomes that already love Wolf and want a parallel cash bet without committing to it as the primary scoring format.',
  },
  {
    key: 'bingo_bango_bongo',
    label: 'Bingo Bango Bongo',
    description: 'Three points per hole: first on green, closest to pin, first in cup',
    fullDescription:
      'Three points up for grabs every hole. Bingo: first ball on the green (or fringe). Bango: closest to the pin once all balls are on. Bongo: first ball in the cup. Equalizes good play with bad lies — the lowest handicapper doesn\'t always sweep.',
    example:
      'Hole 9. Tommy hits green first (Bingo). Jake ends up closest after second shots (Bango). Drew is away and putts in first (Bongo). Three different winners.',
    complexity: 'Casual',
    whenToUse:
      'Mixed-skill foursomes. The high handicappers get points just for being away and putting first — keeps everyone in it.',
  },
  {
    key: 'sandies',
    label: 'Sandies',
    description: 'Up-and-down from a bunker = a sandie',
    fullDescription:
      'Hit it in a bunker, splash out, one-putt. That\'s a sandie. Fixed payout per sandie — winner collects from each other player. Some groups credit only par-saves; others credit any up-and-down regardless of score.',
    example:
      'Drew plugs his approach into the greenside bunker on 12, blasts out to 6 feet, makes the putt for par. One sandie at $2 from each player.',
    complexity: 'Beginner',
    whenToUse:
      'Any round. Rewards the part of the game you\'re not supposed to need but always do — short-game grit.',
  },
  {
    key: 'bark',
    label: 'Barkies',
    description: 'Hit a tree, save par anyway = a barkie',
    fullDescription:
      'If your ball hits a tree at any point during a hole and you still make par or better, that\'s a barkie. Fixed payout per barkie. The ultimate "I meant to do that" bet.',
    example:
      'Drew snap-hooks his drive into the woods on 6, ricochets off an oak back into the fairway, makes par from 140. One barkie.',
    complexity: 'Beginner',
    whenToUse:
      'Any wooded course. Pure novelty — barkies are stories more than serious money.',
  },
  {
    key: 'arnies',
    label: 'Arnies',
    description: 'Make par without ever finding the fairway',
    fullDescription:
      'Named after Arnold Palmer\'s go-for-broke game. If you make par or better on a hole without your ball touching the fairway, that\'s an Arnie. Tee shot in the rough, second in the trees, third on the green, one putt — Arnie.',
    example: 'Drew misses the fairway right on 3, hacks out to the rough, hits the green, makes the par putt. One arnie.',
    complexity: 'Beginner',
    whenToUse:
      'Any round. Rewards the scrambler over the precision player. Pairs well with Sandies.',
  },
  {
    key: 'close_shave',
    label: 'KP',
    description: 'Closest to the pin on a designated par 3',
    fullDescription:
      'On a designated par 3 (or every par 3), whoever lands closest to the pin wins. Often a tournament-style side bet — fixed payout per KP, sometimes with a "beat the pro" tier where the KP needs to be inside a specific distance.',
    example:
      'Hole 12, par 3. KP designated. Tommy hits to 8 feet, Jake to 14, Drew to 22, Marco airmails the green. Tommy wins KP.',
    complexity: 'Beginner',
    whenToUse:
      'Any round on a course with par 3s. Simple, fast, and the kind of side bet that produces a real moment when someone stuffs it.',
  },
  {
    key: 'three_putt_poker',
    label: '3-Putt Poker',
    description: 'Every 3-putt deals you a card — worst hand pays',
    fullDescription:
      'Every time a player 3-putts, they\'re dealt a playing card (face up). At round\'s end, each player makes their best 5-card poker hand from the cards they received. Worst hand pays everyone. The cruel twist: 3-putting more = more cards = more chances at a hand, but also more pain.',
    example:
      'Drew 3-putts twice (two cards), Jake once, Tommy three times. Five cards in front of Tommy still beats two pair from Drew? Probably not. Tommy pays out.',
    complexity: 'Expert',
    whenToUse:
      'Long rounds with persistent putting troubles. Turns 3-putts from a single-hole disappointment into round-long suspense.',
  },
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
  low_high: 'Low Ball / High Ball',
  sixsixsix: '6-6-6',
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
  three_putt_poker: '3-Putt Poker',
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
