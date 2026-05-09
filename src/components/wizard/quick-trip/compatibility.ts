// =============================================================
// Format / side-game compatibility helper
// =============================================================
// Computes whether a given format or side game fits the current roster
// size. Same function works for both surfaces — FormatInfo and
// SideGameInfo both carry a `playerRequirement` field after Phase 2.9.
//
// Three result states:
//   'compatible'             — playerCount fits the requirement exactly
//   'recommended-mismatch'   — `recommended` type and the playerCount
//                              isn't the canonical count (advisory; row
//                              still selectable, advisory tag rendered)
//   'locked-too-few'         — `min` or `exact` requirement isn't met
//                              (row locked, requires-N tag rendered,
//                              tap shows "add more players" toast)
//
// Out of scope for Phase 2.9 UI: upper-bound enforcement. Scramble's
// range '2-4' surfaces a hint in the recommended-mismatch tag but
// doesn't gate at 5+ players. If the upper-bound rule needs to lock
// elsewhere later, extend PlayerRequirement with `max?: number` and
// add a 'locked-too-many' state — this helper has the right shape to
// grow into that.
// =============================================================

import type { PlayerRequirement } from '../../../data/scoring';

export type CompatibilityState =
  | 'compatible'
  | 'recommended-mismatch'
  | 'locked-too-few';

export interface CompatibilityResult {
  state: CompatibilityState;
  /** User-facing message for the row tag / toast. Single line, tracked
   *  caps when rendered. Undefined for the 'compatible' state. */
  message?: string;
}

/** Pluralization helper — "1 PLAYER" vs "N PLAYERS". */
function plural(n: number): string {
  return n === 1 ? 'PLAYER' : 'PLAYERS';
}

export function checkFormatCompatibility(
  info: { playerRequirement?: PlayerRequirement },
  playerCount: number,
): CompatibilityResult {
  // Defensive — if data layer hasn't populated this format, skip the
  // gate and treat as compatible. Shouldn't happen post-Phase 2.9 but
  // keeps the helper safe against transient catalog states.
  if (!info.playerRequirement) return { state: 'compatible' };

  const { type, count, range } = info.playerRequirement;

  if (type === 'min') {
    if (playerCount < count) {
      return {
        state: 'locked-too-few',
        message: `REQUIRES ${count}+ ${plural(count)} · YOU HAVE ${playerCount}`,
      };
    }
    return { state: 'compatible' };
  }

  if (type === 'exact') {
    if (playerCount !== count) {
      return {
        state: 'locked-too-few',
        message: `REQUIRES ${count} ${plural(count)} · YOU HAVE ${playerCount}`,
      };
    }
    return { state: 'compatible' };
  }

  if (type === 'recommended') {
    if (playerCount === count) {
      return { state: 'compatible' };
    }
    // Mismatch — advisory only, row still selectable.
    return {
      state: 'recommended-mismatch',
      message: range
        ? `BEST WITH ${count} ${plural(count)} · WORKS WITH ${range.toUpperCase()}`
        : `BEST WITH ${count} ${plural(count)}`,
    };
  }

  // Exhaustiveness fallthrough — unknown type.
  return { state: 'compatible' };
}
