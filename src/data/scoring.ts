import type { HoleScore, HoleData } from '../scoring/types';
import { isGIR } from '../scoring/gir';

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

/** Player-count constraint per format / side game. Used by Step 4 +
 *  Step 5 of the wizard to gate selectability against state.players.length
 *  (UI lock-out lands in a follow-up phase — Phase 2.9 ships the data). */
export type PlayerRequirement = {
  /** 'min'         — minimum N players, no upper bound
   *  'exact'       — exactly N players (typical for partner formats)
   *  'recommended' — N is the recommended sweet spot; range may
   *                  describe a wider workable window */
  type: 'min' | 'exact' | 'recommended';
  count: number;
  /** Optional display label like "2-4 players" for the recommended
   *  case where count is the canonical default but a range works. */
  range?: string;
};

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
  /** Roster shape this format wants. Drives Step 4's eventual UI
   *  lock-out against the wizard's selected players list. */
  playerRequirement: PlayerRequirement;
  /** Whether the format works asynchronously across different courses
   *  (per-player scorecard) or requires same-course timing for the
   *  mechanic to function (real-time strategy, partner negotiation,
   *  or per-hole pacing). Dormie-specific data point. */
  remoteSafe: boolean;
};

export const SCORING_FORMATS: FormatInfo[] = [
  {
    key: 'stroke_play',
    label: 'Stroke Play',
    description: 'Lowest total score wins',
    fullDescription:
      'The most common form of golf scoring. Add up your strokes across all 18 holes — lowest total wins. No team play, no per-hole shenanigans, just you against the course and the scorecard.',
    example: 'Drew shoots 78, Jake 82, Tommy 85. Drew wins by four.',
    complexity: 'Beginner',
    whenToUse:
      'Clean head-to-head measure of who played best across the whole round. The default for casual rounds and most tournaments.',
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
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
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
  },
  {
    key: 'modified_stableford',
    label: 'Modified Stableford',
    description: 'Stableford with attitude — eagles pay, doubles cost',
    fullDescription:
      'Stableford with sharper teeth. Reward aggressive play harder, punish mistakes harder. Eagle = 5, birdie = 2, par = 0, bogey = -1, double = -3, triple+ = -5. Highest total wins. Used at the Barracuda Championship — go for the green or pay for it.',
    example:
      'Two eagles (10), four birdies (8), nine pars (0), three bogeys (-3) = 15 points. Aggressive day pays.',
    complexity: 'Expert',
    whenToUse:
      'Confident players who want a format that rewards risk. Best for a round where you want the scorecard to tell a story.',
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
  },
  {
    key: 'match_play',
    label: 'Match Play',
    description: 'Head-to-head play, hole by hole',
    fullDescription:
      'Head-to-head play, hole by hole. Singles (1v1), Fourball (2v2), or larger team play. Requires even-numbered roster. Each hole is its own match — win it, lose it, or halve it. Whoever wins more holes wins the round. The pressure is per-hole, and the math gets interesting: 4-up with 4 to play and the match is closed out.',
    example:
      'Drew wins 1, 2, 4, 7, 9. Tommy wins 3, 5, 8. Halved on 6. Drew leads 5-3 with 9 to play.',
    complexity: 'Casual',
    whenToUse:
      'Two-person duels and 2v2 team matches. The format that produces "I\'ll close you out on 14" moments.',
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: false,
  },
  {
    key: 'best_ball',
    label: 'Best Ball',
    description: 'Team format — flexible team structure, best score per hole counts',
    fullDescription:
      'Team format: 2 vs 2 traditional, but flexible — works with any team structure. Each player plays own ball, team uses best score per hole. One partner blows up while the other birdies? Team gets the birdie. Half scramble feel, all individual play.',
    example:
      'Drew makes 5 on hole 4, Jake makes 4. Team score: 4. Add up the team\'s better-ball scores across 18.',
    complexity: 'Casual',
    whenToUse:
      'Mixed-handicap pairs where one player can save the team on a tough hole. Strong foursome format.',
    playerRequirement: { type: 'recommended', count: 4 },
    remoteSafe: true,
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
    playerRequirement: { type: 'recommended', count: 4, range: '2-4' },
    remoteSafe: false,
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
    playerRequirement: { type: 'exact', count: 4 },
    remoteSafe: false,
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
    playerRequirement: { type: 'recommended', count: 4 },
    remoteSafe: false,
  },
  {
    key: 'fourball',
    label: 'Four-Ball',
    description: '2 vs 2 — each player plays own ball, lower score per hole',
    fullDescription:
      'Team format: 2 vs 2, each player plays own ball, team takes lower score per hole. Scoring engine identical to best ball but typically used for match play. The default Ryder Cup session format.',
    example: 'Drew and Tommy as a team. Hole 5: Drew makes 4, Tommy makes 5. Team score 4.',
    complexity: 'Casual',
    whenToUse:
      'Team format where every player\'s round still matters. The standard partner-format for cup competitions.',
    playerRequirement: { type: 'recommended', count: 4 },
    remoteSafe: true,
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
    playerRequirement: { type: 'exact', count: 4 },
    remoteSafe: true,
  },
  {
    key: 'sixsixsix',
    label: '6-6-6',
    description: 'Three partner blocks, six holes each — everyone plays with everyone',
    fullDescription:
      'Foursome format. Three blocks of six holes; partners rotate each block. By round\'s end, you\'ve been partners with each of the others for one block. Each block is its own match — three matches in one round.',
    example:
      'Holes 1-6: Drew + Tommy vs Jake + Marco. Holes 7-12: Drew + Jake vs Tommy + Marco. Holes 13-18: Drew + Marco vs Tommy + Jake.',
    complexity: 'Expert',
    whenToUse:
      'Foursomes that want the team feel without committing to one partner. Equalizes pairings across the round — but tracking three rotating partnerships demands attention.',
    playerRequirement: { type: 'exact', count: 4 },
    remoteSafe: false,
  },
  {
    key: 'alternate_shot',
    label: 'Alternate Shot',
    description: 'Two-player teams; partners alternate strokes',
    fullDescription:
      'Foursomes proper. Two-player teams, one ball per team, partners alternate strokes tee to cup. If A drives, B hits the second, A hits the third, and so on. Honor decides who tees off on the next hole.',
    example: 'Drew tees off on 1. Jake takes the second, Drew the third, Jake holes the putt. Hole 2: Jake tees off.',
    complexity: 'Expert',
    whenToUse:
      'Tournament partner formats. Demands trust — your partner\'s miss is your problem.',
    playerRequirement: { type: 'exact', count: 4 },
    remoteSafe: false,
  },
  {
    key: 'chapman',
    label: 'Chapman',
    description: 'Both drive, hit partner\'s ball, pick best, alternate from there',
    fullDescription:
      'Two-player teams. Both partners drive. Each then hits the partner\'s drive. After the second shots, pick the best ball and alternate from there to the hole. Combines individual play (drives) with partner play (alternate from the third shot).',
    example:
      'Drew and Jake both drive. Drew hits Jake\'s ball, Jake hits Drew\'s ball. Pick Drew\'s lie. Jake plays third, Drew plays fourth, Jake holes out.',
    complexity: 'Expert',
    whenToUse:
      'Partner play that tests both drives and alternate-shot rhythm. The American foursomes standard.',
    playerRequirement: { type: 'exact', count: 4 },
    remoteSafe: false,
  },
  {
    key: 'greensomes',
    label: 'Greensomes',
    description: 'Both drive, pick best, alternate from there',
    fullDescription:
      'Two-player teams. Both partners drive. Pick the best drive. The other partner plays the second shot from there, then alternate strokes to the hole. Lighter than Chapman — only one ball after the drives.',
    example:
      'Drew and Jake both drive. Jake\'s drive is better. Drew plays the second from Jake\'s ball, Jake plays third, Drew plays fourth and holes out.',
    complexity: 'Casual',
    whenToUse:
      'Mixed-skill partner pairs. The strong driver still drives; the partner with the better short game finishes.',
    playerRequirement: { type: 'exact', count: 4 },
    remoteSafe: false,
  },
  {
    key: 'pinehurst',
    label: 'Pinehurst',
    description: 'Foursomes variant where both drive, then partners switch balls',
    fullDescription:
      'Same engine as Chapman. Both partners drive, then each hits the partner\'s ball as the second shot. After the second shots, pick the best ball and alternate to the hole. Some clubs use Pinehurst and Chapman interchangeably; others differ on when the ball is selected.',
    example:
      'Drew and Jake both drive. Drew hits Jake\'s drive for the second shot. Jake hits Drew\'s drive for the second shot. Pick the best lie. Alternate from there.',
    complexity: 'Expert',
    whenToUse:
      'Member-guest tournaments and partner formats with regional traditions. Functionally Chapman.',
    playerRequirement: { type: 'exact', count: 4 },
    remoteSafe: false,
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
  /** Roster shape this side game wants. See FormatInfo.playerRequirement
   *  for the type contract — same shape across both surfaces. */
  playerRequirement: PlayerRequirement;
  /** Whether the side game works async across different courses. Per-
   *  player achievement bets (sandies, barkies, hogans) are remote-
   *  safe; comparison/competition bets that need timing (Nassau,
   *  hammer, BBB) aren't. See FormatInfo.remoteSafe for full contract. */
  remoteSafe: boolean;
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
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: true,
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
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: true,
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
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: true,
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
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: true,
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
      'Match play between confident players who want to swing the round on a single hole. Best when both sides know the format.',
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: false,
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
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: false,
  },
  {
    key: 'wolf',
    label: 'Wolf',
    description: 'Wolf points converted to cash — runs alongside any format',
    fullDescription:
      'A parallel cash bet that runs on top of whatever scoring format you\'re playing. Each hole, the rotating Wolf picks a partner (1 point per hole won) or goes alone for double. At round\'s end, points convert to cash at the agreed rate. Doesn\'t replace the primary format — adds a layer of partner intrigue to it.',
    example:
      'Tommy goes Lone Wolf on 14, beats the others — 2 points. Drew picks a partner on 15, wins — 1 point each. At $2 a point, Tommy collects $4 from the round.',
    complexity: 'Expert',
    whenToUse:
      'Foursomes playing stroke or stableford as the primary format who want partner-rotation cash on the side. Adds spice without rewriting the scorecard.',
    playerRequirement: { type: 'exact', count: 4 },
    remoteSafe: false,
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
    playerRequirement: { type: 'min', count: 3 },
    remoteSafe: false,
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
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
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
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
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
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
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
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: true,
  },
  {
    key: 'three_putt_poker',
    label: '3-Putt Poker',
    description: 'Every 3-putt deals you a card — worst hand pays',
    fullDescription:
      'Every time a player 3-putts, they\'re dealt a playing card (face up). At round\'s end, each player makes their best 5-card poker hand from the cards they received. Worst hand pays everyone. The cruel twist: 3-putting more = more cards = more chances at a hand, but also more pain.',
    example:
      'Drew gets two cards (pair of aces), Jake one, Tommy three of junk. Worst hand pays — Tommy buys the round.',
    complexity: 'Casual',
    whenToUse:
      'Long rounds with persistent putting troubles. Turns 3-putts from a single-hole disappointment into round-long suspense.',
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: true,
  },
  {
    key: 'trash',
    label: 'Trash',
    description: 'Catch-all junk bet — greenies, sandies, barkies, all rolled in',
    fullDescription:
      'An umbrella side bet that bundles several smaller ones (greenies, sandies, barkies, arnies, etc.) into a single "trash" tally. Whoever ends with the most trash wins the agreed payout. Saves you from tracking each side bet individually.',
    example:
      'Drew earns 1 sandie + 2 greenies + 1 barkie = 4 trash. Tommy has 2. Drew wins the trash bet.',
    complexity: 'Casual',
    whenToUse:
      'Groups that want all the small bets without the bookkeeping. A lazy aggregation that keeps the pace.',
    playerRequirement: { type: 'min', count: 2 },
    remoteSafe: true,
  },
  {
    key: 'hogans',
    label: 'Hogans',
    description: 'Fairway, green in regulation, two putts, par or better',
    fullDescription:
      'Named for Ben Hogan\'s relentless ball-striking. Hit the fairway off the tee, hit the green in regulation, two-putt or better, and make par or better. All four conditions required. Fixed payout per Hogan — one of the harder side bets to earn.',
    example:
      'Drew splits the fairway on 8, hits the green with his approach, two-putts for par. One Hogan.',
    complexity: 'Casual',
    whenToUse:
      'Confident ball-strikers who want a side bet rewarding the fundamentals. Pairs well with Sandies and Barkies (which pay when fundamentals fail).',
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
  },
  {
    key: 'murphys',
    label: 'Murphys',
    description: 'Call your up-and-down — make it or pay',
    fullDescription:
      'Around the green and not on it? Call a Murphy: announce you\'ll get up-and-down. Make par from there and you collect from each player. Miss and you pay each player. Optional, declared per shot.',
    example:
      'Drew is in the bunker on 14, 30 feet from the pin. Calls Murphy. Splashes out to 5 feet, makes the par putt. Each player pays Drew $2.',
    complexity: 'Casual',
    whenToUse:
      'Players confident in their short game who want a per-shot side bet. The wager is opt-in — only call when you\'re feeling it.',
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
  },
  {
    key: 'poleys',
    label: 'Poleys',
    description: 'Make a putt longer than the flagstick — that\'s a poley',
    fullDescription:
      'Make any putt longer than the flagstick (typically 4-5 feet) and you\'ve made a poley. Fixed payout per poley — winner collects from each other player. Encourages putting the long ones in instead of leaving them short.',
    example:
      'Drew lags a 35-footer to 8 feet on hole 9. Drains the second putt. One poley.',
    complexity: 'Beginner',
    whenToUse:
      'Any round where you want a putting incentive that rewards confidence on mid-length putts.',
    playerRequirement: { type: 'min', count: 1 },
    remoteSafe: true,
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
  bark: 'Barkies',
  close_shave: 'KP',
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
 * Calculate standard Stableford points for a full round (handicap-aware).
 *
 * Pass handicapStrokesPerHole to compute net Stableford. Omit (or pass
 * undefined) for gross Stableford — each hole computed with 0 strokes.
 *
 * Named distinctly from calculateStablefordFromRound in scoring.service.ts
 * (the gross-only season-path version). This wrapper is the canonical
 * handicap-aware version for live-scoring display.
 */
export function calculateNetStablefordTotal(
  holeScores: number[],
  coursePars: number[],
  handicapStrokesPerHole?: number[],
): number {
  const len = Math.min(holeScores.length, coursePars.length);
  let total = 0;
  for (let i = 0; i < len; i++) {
    const hcpStrokes = handicapStrokesPerHole?.[i] ?? 0;
    total += calculateStablefordPoints(holeScores[i], coursePars[i], hcpStrokes);
  }
  return total;
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

/**
 * Calculate Match Play with handicap-aware net scoring.
 *
 * Subtracts per-hole strokes from each player's gross scores, then
 * delegates to calculateMatchPlay (which is gross-only). Handicap arrays
 * are optional — when omitted (or with missing indices), the corresponding
 * strokes default to 0, producing a gross match.
 *
 * Pass per-hole strokes for each player independently (e.g., from Dormie's
 * handicapStrokes Map<playerId, Map<holeNumber, strokes>>). Comparing
 * net-vs-net produces identical hole-by-hole resolution to the strict USGA
 * "lower handicap plays scratch, higher gets the difference" allocation,
 * since (grossA − strokesA) − (grossB − strokesB) ≡ (grossA − grossB) −
 * (strokesA − strokesB).
 *
 * Named distinctly from:
 * - calculateMatchPlay (above) — the gross-only engine this wraps
 * - evaluateMatch (src/services/fourTeamRyder.service.ts) — the Ryder Cup
 *   four-team variant operating on a different input shape (pre-resolved
 *   hole-winner records, not raw scores). Intentional domain split.
 */
export function calculateNetMatchPlay(
  playerAScores: number[],
  playerBScores: number[],
  handicapStrokesA?: number[],
  handicapStrokesB?: number[],
): MatchPlayResult {
  const netA = playerAScores.map((s, i) => s - (handicapStrokesA?.[i] ?? 0));
  const netB = playerBScores.map((s, i) => s - (handicapStrokesB?.[i] ?? 0));
  return calculateMatchPlay(netA, netB);
}

// ─── Match Play family — Layer B (status formatting) ─────────────────
// Shared formatter consumed by the whole match-play family (singles,
// best-ball-match, alt-shot-match, Ryder Cup matches). Pure: takes
// pre-aggregated totals, returns the match state. Format-agnostic.
//
// See docs/matchplay-architecture.md for the full design. Stage 1 wires
// this for 1v1 singles only; team formats and Ryder Cup migration land
// in later stages against this same engine.

export type MatchPlayStatus = 'FINAL' | 'CLINCHED' | 'DORMIE' | 'AS' | 'UP' | 'DOWN';

export type MatchPlayState = {
  status: MatchPlayStatus;
  lead: number;
  leader: 'A' | 'B' | null;
  isComplete: boolean;
  /** Mid-round "keep computing" form. Examples:
   *   "2 UP thru 9", "AS thru 12", "DORMIE", "3 DOWN thru 5" (with perspective). */
  currentDisplay: string;
  /** End-of-match "ended-on-hole-N" form. Examples:
   *   "2&1", "1 UP", "HALVED". */
  finalDisplay: string;
};

/**
 * Format match-play state from pre-aggregated per-side hole counts.
 *
 * This is the Layer-B engine: it does not look at scores. The caller
 * (Layer A) decides how to derive per-hole side scores for the match
 * format being played (singles = player's score; best-ball = min of
 * side's players; aggregate = sum; alt-shot = single team entry), then
 * counts holes won per side, and passes the totals here.
 *
 * @param holesWonA      Holes won by side A so far.
 * @param holesWonB      Holes won by side B so far.
 * @param holesPlayed    Total holes both sides have entered scores for.
 *                       (Halved holes count toward holesPlayed but neither
 *                       wonA nor wonB.)
 * @param totalHoles     Total holes in the round (typically 18, or 9 for
 *                       a 9-hole match, or holes.length for partial ranges).
 * @param perspective    Optional side identifier for DOWN-formatting in
 *                       currentDisplay. When the perspective side is
 *                       trailing, currentDisplay reads "X DOWN" instead
 *                       of "X UP". finalDisplay is perspective-neutral.
 *
 * DORMIE emits only when `lead === holesRemaining && holesRemaining > 0`
 * — the trailing side cannot win, only halve. Distinct from CLINCHED
 * (`lead > holesRemaining` — match decided).
 */
export function formatMatchState(
  holesWonA: number,
  holesWonB: number,
  holesPlayed: number,
  totalHoles: number,
  perspective?: 'A' | 'B',
): MatchPlayState {
  const lead = Math.abs(holesWonA - holesWonB);
  const leader: 'A' | 'B' | null =
    holesWonA > holesWonB ? 'A'
      : holesWonB > holesWonA ? 'B'
      : null;
  const holesRemaining = Math.max(0, totalHoles - holesPlayed);

  // Match is complete if all holes played OR lead exceeds holes remaining.
  // The `holesPlayed > 0` guard prevents claiming a brand-new round (0/18,
  // lead 0, remaining 18) is somehow complete.
  const isComplete =
    holesPlayed >= totalHoles
    || (lead > holesRemaining && holesPlayed > 0);

  // ─── status ──────────────────────────────────────────────────────
  let status: MatchPlayStatus;
  if (isComplete) {
    status = holesPlayed >= totalHoles ? 'FINAL' : 'CLINCHED';
  } else if (lead === 0) {
    status = 'AS';
  } else if (lead === holesRemaining) {
    // lead > 0 by virtue of the lead===0 branch above; lead === holesRemaining
    // with lead > 0 is DORMIE.
    status = 'DORMIE';
  } else {
    // Mid-round, someone leads, not dormie. Perspective drives UP vs DOWN.
    status = perspective && perspective !== leader ? 'DOWN' : 'UP';
  }

  // ─── currentDisplay (mid-round / live banner form) ───────────────
  let currentDisplay: string;
  if (lead === 0) {
    currentDisplay = holesPlayed > 0 ? `AS thru ${holesPlayed}` : 'AS';
  } else if (status === 'DORMIE') {
    currentDisplay = 'DORMIE';
  } else if (perspective && perspective !== leader) {
    currentDisplay = `${lead} DOWN thru ${holesPlayed}`;
  } else {
    currentDisplay = `${lead} UP thru ${holesPlayed}`;
  }

  // ─── finalDisplay (end-of-match / post-round form) ───────────────
  let finalDisplay: string;
  if (lead === 0) {
    finalDisplay = 'HALVED';
  } else if (holesRemaining === 0) {
    // Won on the final hole (lead === 1 and last hole was decisive,
    // or any lead with holesPlayed === totalHoles).
    finalDisplay = `${lead} UP`;
  } else {
    // Clinched early: "X&M" where M is holes remaining.
    finalDisplay = `${lead}&${holesRemaining}`;
  }

  return { status, lead, leader, isComplete, currentDisplay, finalDisplay };
}

// ─── Match Play family — Layer A (per-hole side-score derivation) ────
// Format-specific. Stage 1 implements singles; best-ball / aggregate /
// alt-shot variants slot in beside this in Stage 4.

/**
 * Derive a 1v1-singles side's score for one hole.
 *
 * Gross: caller passes 0 (or omits) for `handicapStrokesForHole`.
 * Net:   caller passes the player's per-hole strokes from the live
 *        scoring path's `handicapStrokes: Map<playerId, Map<hole, strokes>>`.
 *
 * Returns null when the player has not entered a gross score for the hole,
 * letting the caller skip the hole entirely (no spurious 0-vs-0 halve).
 */
export function deriveSinglesSideScore(
  gross: number | undefined | null,
  handicapStrokesForHole: number = 0,
): number | null {
  if (gross === undefined || gross === null) return null;
  return gross - handicapStrokesForHole;
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

/**
 * Calculate Best Ball with handicap-aware net scoring.
 *
 * Subtracts per-hole strokes for each player to build per-player net score
 * arrays, then delegates to calculateBestBall (which is gross-only). The
 * "net before best-pick" order is the correctness crux: a player getting
 * a stroke on a hard hole may post the team's better ball even though
 * their gross was higher. Picking the best gross then subtracting strokes
 * would silently lose that player's contribution.
 *
 * handicapStrokesPerPlayer[i] corresponds to playerScores[i] by index.
 * Missing inner arrays (undefined / empty / index out of range) default
 * to 0 strokes for that player/hole — useful for asymmetric rosters
 * where only some players carry handicaps.
 *
 * Shared engine with Four-Ball (fourball): identical per-hole best-ball
 * mechanic. Match-play composition (fourball as 2v2 match) is a separate
 * display-layer concern — feed each team's teamScorePerHole into
 * calculateNetMatchPlay rather than adding a new engine.
 */
export function calculateNetBestBall(
  playerScores: number[][],
  handicapStrokesPerPlayer?: number[][],
): BestBallResult {
  const netScores = playerScores.map((scores, playerIdx) => {
    const playerStrokes = handicapStrokesPerPlayer?.[playerIdx];
    return scores.map((s, holeIdx) => s - (playerStrokes?.[holeIdx] ?? 0));
  });
  return calculateBestBall(netScores);
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

// ─── Auto-detect counter side-game engines ──────────────────────────
// Pure functions over captured HoleScore data — no toast confirmation
// required, no persistence scaffolding needed. Counter outputs feed
// later render passes and the parametric Trash composition.

/**
 * Count Arnies per player. An Arnie = par or better on a hole where the
 * player did NOT hit the fairway and did NOT hit green in regulation.
 * Named after Arnold Palmer's scrambling game.
 *
 * Mirrors the auto-detect condition used by the existing semi-auto
 * toast for arnies (SideGameToast.tsx). Par 3 holes have fir === null
 * and are excluded (no fairway to miss).
 */
export function calculateArniesCount(
  allScores: Map<number, Map<string, HoleScore>>,
  holes: HoleData[],
): Map<string, number> {
  const counts = new Map<string, number>();
  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, playerId) => {
      if (s.gross <= h.par && s.fir === false && !isGIR(s.gross, s.putts, h.par)) {
        counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
      }
    });
  });
  return counts;
}

/**
 * Count Hogans per player. A Hogan requires all four conditions on a
 * single hole: (1) hit the fairway off the tee, (2) hit green in
 * regulation, (3) two-putt or better, (4) par or better. Named after
 * Ben Hogan's ball-striking precision.
 *
 * Pure auto-detect from HoleScore — no toast exists for Hogans today.
 * Par 3 holes have fir === null and are excluded (no fairway off the
 * tee). Same par-3 exclusion semantics as Arnies for consistency.
 */
export function calculateHogansCount(
  allScores: Map<number, Map<string, HoleScore>>,
  holes: HoleData[],
): Map<string, number> {
  const counts = new Map<string, number>();
  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, playerId) => {
      if (
        s.gross <= h.par &&
        s.fir === true &&
        isGIR(s.gross, s.putts, h.par) &&
        s.putts <= 2
      ) {
        counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
      }
    });
  });
  return counts;
}

/**
 * Trash component side-game keys. Per SIDE_GAMES description, Trash
 * bundles the small "junk" bets (greenies, sandies, barkies, arnies)
 * into a single tally. Parametric so callers can include any subset
 * (e.g., only the side games that are wired in a given trip).
 */
export type TrashComponent = 'greenies' | 'sandies' | 'bark' | 'arnies';

/**
 * Sum a player's Trash component counts. Caller iterates per player
 * and provides whichever components are tracked for the round.
 * Missing component keys default to 0.
 */
export function calculateTrashTotal(
  counts: Partial<Record<TrashComponent, number>>,
): number {
  return (counts.greenies ?? 0)
    + (counts.sandies ?? 0)
    + (counts.bark ?? 0)
    + (counts.arnies ?? 0);
}

// ─── Side-game persistence slice + Tier B counter engines ───────────
// Unified persistence shape for toast-confirmed side-game events:
// gameKey → playerId → holeNumber → value (boolean for sandies/bark,
// numeric distance for poleys). Engines consume type-narrowed per-game
// sub-slices rather than the heterogeneous top-level shape.

/**
 * Top-level persistence slice for toast-confirmed side-game events.
 * Outer key: gameKey ('sandies' | 'bark' | 'poleys' | future games).
 * Middle key: playerId. Inner key: holeNumber.
 * Value: boolean (sandies/bark = confirmed) or number (poleys = distance).
 * Lives on useScoringState alongside sideGameToastEvents.
 */
export type SideGameEventSlice = Map<string, Map<string, Map<number, boolean | number>>>;

/** Per-game sub-slice for boolean-valued side games (sandies, bark). */
export type SideGameBooleanSlice = Map<string, Map<number, boolean>>;

/** Per-game sub-slice for numeric-valued side games (poleys distance). */
export type SideGameNumericSlice = Map<string, Map<number, number>>;

/**
 * Poleys distance threshold in feet. A poley = a one-putt made from
 * MORE THAN this distance (strict greater-than). Hardcoded for beta;
 * configurability composted as a future option.
 */
export const POLEYS_THRESHOLD_FEET = 4;

/** Internal: count `true` entries per player. Shared by sandies + bark. */
function countConfirmedBoolean(slice: SideGameBooleanSlice): Map<string, number> {
  const counts = new Map<string, number>();
  slice.forEach((perHoleMap, playerId) => {
    let count = 0;
    perHoleMap.forEach((value) => {
      if (value === true) count++;
    });
    if (count > 0) counts.set(playerId, count);
  });
  return counts;
}

/**
 * Count Sandies per player from confirmed toast responses.
 * A sandie = up-and-down from a bunker (par or better, played from sand).
 * Cannot be auto-detected — requires user confirmation that the player
 * was in a bunker. Counts entries where the user tapped "yes" on the
 * semi-auto sandies toast.
 */
export function calculateSandiesCount(slice: SideGameBooleanSlice): Map<string, number> {
  return countConfirmedBoolean(slice);
}

/**
 * Count Barkies per player from confirmed toast responses.
 * A barkie = par or better on a hole where the ball hit a tree.
 * Cannot be auto-detected — requires user confirmation of tree contact.
 * Counts entries where the user tapped "yes" on the semi-auto bark toast.
 */
export function calculateBarkiesCount(slice: SideGameBooleanSlice): Map<string, number> {
  return countConfirmedBoolean(slice);
}

/**
 * Count Poleys per player from confirmed toast responses.
 * A poley = one-putt made from MORE THAN POLEYS_THRESHOLD_FEET (4 ft).
 * Caller stores the numeric distance from the manual-input toast; engine
 * filters by threshold. Strict greater-than: exactly 4 ft does NOT count.
 */
export function calculatePoleysCount(slice: SideGameNumericSlice): Map<string, number> {
  const counts = new Map<string, number>();
  slice.forEach((perHoleMap, playerId) => {
    let count = 0;
    perHoleMap.forEach((distance) => {
      if (distance > POLEYS_THRESHOLD_FEET) count++;
    });
    if (count > 0) counts.set(playerId, count);
  });
  return counts;
}
