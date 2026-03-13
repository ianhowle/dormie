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
