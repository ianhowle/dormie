// =============================================================
// Trip Launched — roster + sentence helpers
// =============================================================
// Two pure functions translating a player array into:
//   - layout config (avatar size, gap, cadence, row split) for the rail
//   - the recap sentence + the index where "you" sits inside it
//
// Ryder Cup variants are NOT handled here — those land in Phase 1.9e
// once `format === 'ryderCup'` × team assignment shape is in scope.
// The non-Ryder-Cup variants here mirror the spec table:
//
//   N         | avatar | gap | rows | cadence | sentence form
//   ----------|--------|-----|------|---------|-------------------------
//   1 (solo)  | —      | —   | —    | —       | "Just you."
//   2–4       | 44px   | 8px | 1    | 180ms   | full names list
//   5–8       | 40px   | 6px | 1    | 180ms   | full names list
//   9–12 flat | 36px   | 5px | 2    | 110ms   | "X, Y, Z, and N others — including you."
//
// Reference: docs/trip-launched-design-spec-2026-05-05.md
// =============================================================

export interface TripLaunchedPlayer {
  name: string;
  avatarUrl?: string;
  isYou?: boolean;
}

export type RosterVariant = 'solo' | 'standard' | 'medium' | 'large';

export interface RosterConfig {
  variant: RosterVariant;
  avatarSize: number;
  gap: number;
  cadence: number;
  /** Length of each rendered row, summing to orderedPlayers.length.
   *  Empty for solo (no rail). */
  rowSplits: number[];
}

export interface SentenceShape {
  text: string;
  /** Character index where the word "you" begins inside `text`, or -1
   *  if "you" is not present (e.g., undrafted Ryder Cup, future). */
  youAt: number;
}

/** Reorders so the "you" player anchors row 1 leftmost. Non-you players
 *  preserve their input order behind "you". If no player is flagged
 *  isYou, returns the input unchanged. */
export function orderPlayersForRail(
  players: TripLaunchedPlayer[],
): TripLaunchedPlayer[] {
  const youIdx = players.findIndex((p) => p.isYou);
  if (youIdx < 0) return players.slice();
  const others = players.filter((p) => !p.isYou);
  return [players[youIdx], ...others];
}

export function computeRoster(
  orderedPlayers: TripLaunchedPlayer[],
): RosterConfig {
  const N = orderedPlayers.length;

  if (N <= 1) {
    return {
      variant: 'solo',
      avatarSize: 0,
      gap: 0,
      cadence: 0,
      rowSplits: [],
    };
  }

  if (N <= 4) {
    return {
      variant: 'standard',
      avatarSize: 44,
      gap: 8,
      cadence: 180,
      rowSplits: [N],
    };
  }

  if (N <= 8) {
    return {
      variant: 'medium',
      avatarSize: 40,
      gap: 6,
      cadence: 180,
      rowSplits: [N],
    };
  }

  // 9–12 flat: two rows, ceil on top so "you" + 5 others fill row 1 first
  const top = Math.ceil(N / 2);
  return {
    variant: 'large',
    avatarSize: 36,
    gap: 5,
    cadence: 110,
    rowSplits: [top, N - top],
  };
}

/** Joins names with Oxford-style commas: ["A"] → "A", ["A","B"] →
 *  "A and B", ["A","B","C"] → "A, B, and C". */
function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function buildSentence(
  orderedPlayers: TripLaunchedPlayer[],
): SentenceShape {
  const N = orderedPlayers.length;
  const youIncluded = orderedPlayers.some((p) => p.isYou);
  const others = orderedPlayers.filter((p) => !p.isYou);

  // Solo
  if (N === 1 && youIncluded) {
    const text = 'Just you.';
    return { text, youAt: text.lastIndexOf('you') };
  }

  // Large (9+): summary form. Top 3 named, remainder collapsed.
  if (N >= 9) {
    const top3 = others.slice(0, 3).map((p) => p.name).join(', ');
    const remaining = others.length - 3;
    if (youIncluded) {
      const text = `${top3}, and ${remaining} others — including you.`;
      return { text, youAt: text.lastIndexOf('you') };
    }
    const text = `${top3}, and ${remaining} others.`;
    return { text, youAt: -1 };
  }

  // Standard / Medium (2–8): full names list with "you" as the
  // final list item. Treating it as the last entry in joinNames keeps
  // the Oxford-comma rules consistent: "Drew and you." (2),
  // "Drew, Jake, and you." (3), "Drew, Jake, Tommy, and you." (4+).
  if (youIncluded) {
    const text = `${joinNames([...others.map((p) => p.name), 'you'])}.`;
    return { text, youAt: text.lastIndexOf('you') };
  }

  // No "you" in 2–8 — uncommon (no first-person actor) but graceful
  return { text: `${joinNames(others.map((p) => p.name))}.`, youAt: -1 };
}
