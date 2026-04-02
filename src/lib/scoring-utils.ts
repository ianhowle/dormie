// ─── Shared scoring utilities ──────────────────────────────────────────
// Single source of truth for score colors, names, hole generation, and game values.

// ─── Score Colors ─────────────────────────────────────────────────────
export const SCORE_COLORS = {
  eagle: '#B8860B',
  birdie: '#C41E3A',
  par: '#006747',
  bogey: '#6B8E23',
  double: '#8B4513', // uses textMuted in practice for double+
} as const;

/** Get the display color for a score relative to par. Pass textMuted for double+ fallback. */
export function scoreColor(gross: number, par: number, textMuted = '#6B6560'): string {
  const diff = gross - par;
  if (diff <= -2) return SCORE_COLORS.eagle;
  if (diff === -1) return SCORE_COLORS.birdie;
  if (diff === 0) return SCORE_COLORS.par;
  if (diff === 1) return SCORE_COLORS.bogey;
  return textMuted;
}

// ─── Score Names ──────────────────────────────────────────────────────
export function scoreName(gross: number, par: number): string {
  const diff = gross - par;
  if (diff <= -3) return 'Albatross';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double Bogey';
  if (diff === 3) return 'Triple';
  if (diff === 4) return 'Quad';
  return `+${diff}`;
}

/** Short score name for compact displays. */
export function scoreNameShort(gross: number, par: number): string {
  const diff = gross - par;
  if (diff <= -3) return 'Alba';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double';
  if (diff === 3) return 'Triple';
  if (diff === 4) return 'Quad';
  return `+${diff}`;
}

// ─── To-par formatting ───────────────────────────────────────────────
export function formatToPar(score: number, par: number): string {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export function toParColor(score: number, par: number, c: { teal: string; urgent: string; text: string }): string {
  const diff = score - par;
  if (diff < 0) return c.teal;
  if (diff > 0) return c.urgent;
  return c.text;
}

// ─── Default Hole Generation ──────────────────────────────────────────
// When no API data: Par 72 = {par3:4, par4:10, par5:4}
// Par 3 positions: front [3,8] (indices 2,7), back [12,17] (indices 2,7 in back9)
// Par 5 positions: front [5,9] (indices 4,8), back [13,16] (indices 3,6 in back9)

export type GeneratedHole = {
  number: number;
  par: number;
  strokeIndex: number;
  yards: number;
};

const FRONT_HCP = [7, 3, 15, 1, 11, 13, 5, 9, 17];
const BACK_HCP = [8, 12, 16, 2, 6, 10, 14, 4, 18];

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function yardageForPar(par: number): number {
  if (par === 3) return randomBetween(145, 205);
  if (par === 5) return randomBetween(495, 580);
  return randomBetween(355, 440);
}

export function generateDefaultHoles(coursePar = 72): GeneratedHole[] {
  // Standard layout: par 3s at holes 3,8,12,17; par 5s at 5,9,13,16; rest par 4
  const pars = [4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 5, 3, 4];

  // Adjust to match course par
  const totalStd = pars.reduce((a, b) => a + b, 0); // 72
  let diff = coursePar - totalStd;
  let idx = 0;
  while (diff > 0 && idx < 18) {
    if (pars[idx] === 4) { pars[idx] = 5; diff--; }
    idx++;
  }
  idx = 17;
  while (diff < 0 && idx >= 0) {
    if (pars[idx] === 4) { pars[idx] = 3; diff++; }
    idx--;
  }

  const hcps = [...FRONT_HCP, ...BACK_HCP];

  return pars.map((par, i) => ({
    number: i + 1,
    par,
    strokeIndex: hcps[i],
    yards: yardageForPar(par),
  }));
}

/** Format hole info line: "Par 4 • 420 yds • HCP 6" */
export function holeInfoLine(par: number, yards: number, hcp: number): string {
  return `Par ${par} • ${yards} yds • HCP ${hcp}`;
}

// ─── Dots/Trash Values ────────────────────────────────────────────────
export const DOTS_VALUES = {
  birdie: +1,
  eagle: +2,
  sandSave: +1,
  onePutt: +1,
  threePutt: -1,
  water: -1,
  ob: -1,
} as const;

// ─── Wolf Earnings ────────────────────────────────────────────────────
export const WOLF_MULTIPLIERS = {
  normal: 1,    // partner win: wolf +mult, partner +mult, losers -1
  loneWolf: 2,  // 2× stakes
  blindWolf: 4, // 4× stakes
} as const;

export function wolfEarnings(
  isWolf: boolean,
  won: boolean,
  isLone: boolean,
  isBlind: boolean,
  numOthers: number,
  baseStake: number,
): number {
  const mult = isBlind ? WOLF_MULTIPLIERS.blindWolf : isLone ? WOLF_MULTIPLIERS.loneWolf : WOLF_MULTIPLIERS.normal;
  if (isWolf) {
    return won ? baseStake * mult * numOthers : -(baseStake * mult * numOthers);
  }
  // Partner or opponent
  return won ? baseStake * mult : -(baseStake * mult);
}

// ─── Quota Calculation ────────────────────────────────────────────────
export function quotaTarget(handicap: number): number {
  return 36 - handicap;
}

export function quotaResult(stablefordPoints: number, handicap: number): number {
  return stablefordPoints - quotaTarget(handicap);
}

// ─── Match Play Status ────────────────────────────────────────────────
export function matchStatus(
  leadScore: number,
  trailScore: number,
  holesRemaining: number,
  totalHoles: number,
): string {
  const diff = leadScore - trailScore;
  if (diff === 0) return 'AS'; // All Square

  const lead = diff > 0 ? diff : -diff;

  // Match is over
  if (lead > holesRemaining && holesRemaining > 0) {
    return `${lead}&${holesRemaining}`;
  }
  if (holesRemaining === 0) {
    if (diff === 0) return 'HALVED';
    return `${lead}&0`; // shouldn't happen in practice
  }

  // Dormie: lead equals holes remaining
  if (lead === holesRemaining) {
    return `DORMIE (${lead} UP, ${holesRemaining} to play)`;
  }

  return `${lead} UP`;
}

// ─── Leaderboard Movement Arrows ──────────────────────────────────────
export type Movement = 'up' | 'down' | 'same';

export function movementArrow(movement: Movement): string {
  if (movement === 'up') return '▲';
  if (movement === 'down') return '▼';
  return '–';
}

export function movementColor(movement: Movement): string {
  if (movement === 'up') return '#006747'; // green/teal
  if (movement === 'down') return '#C41E3A'; // red
  return '#6B6560'; // muted
}
