// TODO: Full scoring engine (1,635 lines)
// 13 formats, 16 side games, all calculations

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
