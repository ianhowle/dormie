// =============================================================
// Pure helpers for Step 7 (Confirm + Launch)
// =============================================================
// Extracted from Step7Confirm.tsx so they're testable from ts-node
// without pulling in react-native or expo-router imports.
// =============================================================

import {
  FORMAT_LABELS,
  SIDE_GAME_LABELS,
  type ScoringFormat,
  type SideGame,
} from '../../../data/scoring';
import { fromYMD } from './dateHelpers';

/** Per-game stake shape used by the wizard reducer. Duplicated here
 *  rather than imported from WizardContext (which has React deps) so
 *  the helpers compile cleanly in test isolation. Keep the shape in
 *  sync — TS will catch mismatches via the export site. */
export interface WizardPerGameStake {
  amount: number;
  config: unknown; // PerGameStakeConfig — opaque to summarizer
}

/** Title-case auto-derivation: "Pinehurst Oct 2026". The cinematic
 *  kicker / Trips-list card apply textTransform if uppercase is
 *  desired — keeps the underlying string clean. */
export function deriveTripName(courseName: string, ymd: string): string {
  if (!courseName) return '';
  const date = fromYMD(ymd);
  if (!date) return courseName;
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${courseName} ${month} ${date.getFullYear()}`;
}

/** Quick Trip is single-day — formats the start date as "Oct 15, 2026". */
export function formatDateRange(ymd: string): string {
  const d = fromYMD(ymd);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Builds the cinematic stakes string from the user's selections.
 *  Returns undefined when format is unset → caller should fall back
 *  to the cinematic's defaultStakes() helper. */
export function summarizeStakesForCinematic(
  format: ScoringFormat | null,
  sideGames: SideGame[],
  perGameStakes: Record<string, WizardPerGameStake>,
): string | undefined {
  if (!format) return undefined;
  const label = (FORMAT_LABELS[format] ?? format).toUpperCase();
  const formatStake = perGameStakes[format];
  let result = label;
  if (formatStake && formatStake.amount > 0) {
    result += ` · $${formatStake.amount}`;
  }
  if (sideGames.length > 0 && sideGames.length <= 2) {
    const labels = sideGames.map((g) =>
      (SIDE_GAME_LABELS[g] ?? g).toUpperCase(),
    );
    result += ` + ${labels.join(' + ')}`;
  } else if (sideGames.length > 2) {
    result += ` + ${sideGames.length} GAMES`;
  }
  return result;
}

/** Reason copy for the disabled-launch state. */
export function fireFloorReasonCopy(
  reason: 'identity' | 'time' | 'people',
): string {
  switch (reason) {
    case 'identity':
      return 'Add a destination to launch';
    case 'time':
      return 'Add a date to launch';
    case 'people':
      return 'Add at least yourself to launch';
  }
}
