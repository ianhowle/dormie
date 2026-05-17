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
import type { PerGameStakeConfig } from '../perGameStakeTypes';
import { fromYMD } from './dateHelpers';

/** Per-game stake shape used by the wizard reducer. Mirrors the
 *  WizardContext shape; types are imported from the pure
 *  perGameStakeTypes module so this file stays free of RN deps and
 *  compiles cleanly in test isolation. */
export interface WizardPerGameStake {
  amount: number;
  config: PerGameStakeConfig;
}

/** Display-safe short venue name for the auto-derived trip title.
 *  Splits on " - " first so multi-course resorts ("Hermitage Golf
 *  Course - Presidents Reserve") collapse to the leading venue
 *  ("Hermitage Golf Course"), then strips trailing common golf nouns
 *  so the title reads "Hermitage Nov 2026" not "Hermitage Golf
 *  Course Nov 2026". Preserves casing (display, not comparison —
 *  see stripGolfWords in courses.service for the lowercase fuzzy
 *  variant). Defensive fallback prevents stripping from returning
 *  empty when the input had content. */
export function shortVenueName(courseName: string): string {
  if (!courseName) return '';
  const beforeDash = courseName.split(/\s+[-–—]\s+/)[0];
  const stripped = beforeDash
    .replace(
      /\s+(Golf\s+(Course|Club)|Country\s+Club|Golf\s+Links|Links|Resort|Club)$/i,
      '',
    )
    .trim();
  return stripped || beforeDash || courseName;
}

/** Title-case auto-derivation: "Pinehurst Oct 2026". The cinematic
 *  kicker / Trips-list card apply textTransform if uppercase is
 *  desired — keeps the underlying string clean. Course name is
 *  shortened via shortVenueName so multi-course resorts and long
 *  full names ("Hermitage Golf Course - Presidents Reserve")
 *  collapse to a display-friendly venue ("Hermitage") before the
 *  date suffix is appended. */
export function deriveTripName(courseName: string, ymd: string): string {
  if (!courseName) return '';
  const venue = shortVenueName(courseName);
  const date = fromYMD(ymd);
  if (!date) return venue;
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${venue} ${month} ${date.getFullYear()}`;
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
