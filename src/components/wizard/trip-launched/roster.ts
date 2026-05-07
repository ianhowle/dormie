// =============================================================
// Trip Launched — roster + sentence helpers
// =============================================================
// Pure functions translating a player array (+ optional Ryder Cup
// configuration) into:
//   - layout config (avatar size, gap, cadence, row split, variant)
//   - the recap sentence + the index where "you" sits inside it
//
// Non-Ryder-Cup variants mirror the spec table:
//
//   N         | avatar | gap | rows | cadence | sentence form
//   ----------|--------|-----|------|---------|-------------------------
//   1 (solo)  | —      | —   | —    | —       | "Just you."
//   2–4       | 44px   | 8px | 1    | 180ms   | full names list
//   5–8       | 40px   | 6px | 1    | 180ms   | full names list
//   9–12 flat | 36px   | 5px | 2    | 110ms   | "X, Y, Z, and N others — including you."
//
// Ryder Cup states (Phase 1.9e) — `format === 'ryderCup'`:
//   undrafted        | 36px | 5px | 2 | 110ms | "Twelve players. Two captains. Draft night to come."
//   drafted-default  | 36px | 5px | 2 (one per team) | 110ms | "Team A's 6 vs. Team B's 6 — and you on Team A."
//   drafted-custom   | 36px | 5px | 2 (one per team) | 110ms | "The Generals' 6 vs. The Outlaws' 6 — and you on The Generals."
//
// Reference: docs/trip-launched-design-spec-2026-05-05.md
// =============================================================

export interface TripLaunchedPlayer {
  name: string;
  avatarUrl?: string;
  isYou?: boolean;
  /** Ryder Cup team assignment. 'a'/'b' is the new key shape; the
   *  legacy 'usa'/'europe' values are normalized to 'a'/'b' via
   *  normalizeTeamKey() so existing data flows continue to work. */
  team?: 'a' | 'b' | 'usa' | 'europe';
  /** Marks this player as one of the two Ryder Cup captains. Renders
   *  a championshipGold rotated-diamond pip above the avatar tile.
   *  Captain status is independent of team assignment — undrafted
   *  rosters still mark captains via this flag. */
  isCaptain?: boolean;
}

export interface RyderTeamConfig {
  /** Display name. "Team A" / "Team B" for default mode; arbitrary
   *  for custom mode (e.g., "The Generals", "The Outlaws"). */
  name: string;
  /** Solid team color used for label, border, and (faintly) tint. */
  color: string;
  /** Translucent halo color for the team's avatar tiles. */
  glow: string;
}

export interface RyderTeams {
  a: RyderTeamConfig;
  b: RyderTeamConfig;
}

/** Three Ryder Cup sub-states (or null for non-Ryder-Cup formats). */
export type RyderState =
  | 'undrafted'
  | 'drafted-default'
  | 'drafted-custom';

export type RosterVariant =
  | 'solo'
  | 'standard'
  | 'medium'
  | 'large'
  // Single neutral rail (2 rows of 6, symmetric, no you-anchoring).
  // "DRAFT NIGHT TBD" pin sits above. Captains marked with pip.
  | 'ryder-undrafted'
  // Two team rails stacked (home team on top). Each row is its own
  // rail with a team label above. "You" anchors leftmost on home team.
  | 'ryder-drafted';

export interface RosterConfig {
  variant: RosterVariant;
  avatarSize: number;
  gap: number;
  cadence: number;
  /** Row sizes summing to orderedPlayers.length. Empty for solo.
   *  Non-Ryder: stacked rows in a single rail (e.g., [6,5] for 11p).
   *  ryder-undrafted: two rows of 6 in a single rail.
   *  ryder-drafted: two SEPARATE team rails (home first). */
  rowSplits: number[];
  /** Sub-state for Ryder Cup variants. undefined for non-Ryder. */
  ryderState?: RyderState;
}

export interface SentenceShape {
  text: string;
  /** Character index where the word "you" begins inside `text`, or -1
   *  if "you" is not present (e.g., undrafted Ryder Cup, where the
   *  captains are the actors and the user is a participant, not the
   *  signature anchor). */
  youAt: number;
}

/** Maps the legacy 'usa'/'europe' team keys to the new 'a'/'b' shape.
 *  Returns undefined if the team key is missing or unrecognized. */
export function normalizeTeamKey(
  team?: TripLaunchedPlayer['team'],
): 'a' | 'b' | undefined {
  if (team === 'a' || team === 'usa') return 'a';
  if (team === 'b' || team === 'europe') return 'b';
  return undefined;
}

/** Detects Ryder Cup sub-state from format + player team assignments
 *  + presence of custom teams. Returns null when not Ryder Cup at all. */
export function detectRyderState(
  players: TripLaunchedPlayer[],
  format?: string,
  ryderTeams?: RyderTeams,
): RyderState | null {
  if (format !== 'ryderCup') return null;
  const hasTeamAssignments = players.some(
    (p) => normalizeTeamKey(p.team) !== undefined,
  );
  if (!hasTeamAssignments) return 'undrafted';
  return ryderTeams ? 'drafted-custom' : 'drafted-default';
}

/** Reorders the player array for rail rendering.
 *
 *  Non-Ryder: "you" anchors leftmost in row 1, others follow in input
 *  order.
 *  Ryder undrafted: ORIGINAL order preserved — captains differentiate
 *  by pip, not position. Per spec exception.
 *  Ryder drafted: home team first (the team containing "you"), then
 *  away team. Within each team, "you" anchors leftmost. */
export function orderPlayersForRail(
  players: TripLaunchedPlayer[],
  ryderState?: RyderState | null,
): TripLaunchedPlayer[] {
  // Undrafted Ryder: spec exception — preserve input order
  if (ryderState === 'undrafted') return players.slice();

  // Drafted Ryder: home team (containing "you") first, then away
  if (ryderState === 'drafted-default' || ryderState === 'drafted-custom') {
    const youPlayer = players.find((p) => p.isYou);
    const youTeam = youPlayer ? normalizeTeamKey(youPlayer.team) : 'a';
    const teamA = players.filter((p) => normalizeTeamKey(p.team) === 'a');
    const teamB = players.filter((p) => normalizeTeamKey(p.team) === 'b');
    const reorderTeam = (team: TripLaunchedPlayer[]) => {
      const youIdx = team.findIndex((p) => p.isYou);
      if (youIdx < 0) return team.slice();
      const others = team.filter((p) => !p.isYou);
      return [team[youIdx], ...others];
    };
    return youTeam === 'b'
      ? [...reorderTeam(teamB), ...reorderTeam(teamA)]
      : [...reorderTeam(teamA), ...reorderTeam(teamB)];
  }

  // Non-Ryder: existing you-first behavior
  const youIdx = players.findIndex((p) => p.isYou);
  if (youIdx < 0) return players.slice();
  const others = players.filter((p) => !p.isYou);
  return [players[youIdx], ...others];
}

export function computeRoster(
  orderedPlayers: TripLaunchedPlayer[],
  ryderState?: RyderState | null,
): RosterConfig {
  const N = orderedPlayers.length;

  // ─── Ryder Cup variants ────────────────────────────────────────
  if (ryderState === 'undrafted') {
    // Single neutral rail, 2 rows of 6 (or however the player count
    // splits — defensive: spec specifies 12 but we tolerate other
    // counts gracefully).
    const top = Math.ceil(N / 2);
    return {
      variant: 'ryder-undrafted',
      avatarSize: 36,
      gap: 5,
      cadence: 110,
      rowSplits: [top, N - top],
      ryderState: 'undrafted',
    };
  }

  if (ryderState === 'drafted-default' || ryderState === 'drafted-custom') {
    // Two team rails. orderedPlayers is [...homeTeam, ...awayTeam].
    // Row sizes derived from team membership counts.
    const youPlayer = orderedPlayers.find((p) => p.isYou);
    const youTeam = youPlayer ? normalizeTeamKey(youPlayer.team) : 'a';
    const sizeA = orderedPlayers.filter(
      (p) => normalizeTeamKey(p.team) === 'a',
    ).length;
    const sizeB = orderedPlayers.filter(
      (p) => normalizeTeamKey(p.team) === 'b',
    ).length;
    const homeFirst = youTeam === 'b' ? [sizeB, sizeA] : [sizeA, sizeB];
    return {
      variant: 'ryder-drafted',
      avatarSize: 36,
      gap: 5,
      cadence: 110,
      rowSplits: homeFirst,
      ryderState,
    };
  }

  // ─── Non-Ryder variants (existing behavior) ────────────────────
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

/** English possessive for a team or individual name. Names ending in
 *  's' take a trailing apostrophe only ("The Generals'"); others take
 *  apostrophe-s ("Team A's"). */
export function buildPossessive(name: string): string {
  if (name.endsWith('s') || name.endsWith('S')) return `${name}'`;
  return `${name}'s`;
}

export function buildSentence(
  orderedPlayers: TripLaunchedPlayer[],
  ryderState?: RyderState | null,
  ryderTeams?: RyderTeams,
): SentenceShape {
  // ─── Ryder Cup branches ────────────────────────────────────────
  if (ryderState === 'undrafted') {
    const captainCount = orderedPlayers.filter((p) => p.isCaptain).length;
    // Per spec edge case: if only one captain assigned (or none),
    // drop the "Two captains." sentence and read just the player count.
    const text =
      captainCount === 2
        ? 'Twelve players. Two captains. Draft night to come.'
        : 'Twelve players. Draft night to come.';
    // youAt: -1 — captains are the actors in undrafted, no underline
    return { text, youAt: -1 };
  }

  if (ryderState === 'drafted-default' || ryderState === 'drafted-custom') {
    const youPlayer = orderedPlayers.find((p) => p.isYou);
    const youTeamKey = youPlayer
      ? normalizeTeamKey(youPlayer.team) ?? 'a'
      : 'a';
    const aName = ryderTeams?.a.name ?? 'Team A';
    const bName = ryderTeams?.b.name ?? 'Team B';
    const aCount = orderedPlayers.filter(
      (p) => normalizeTeamKey(p.team) === 'a',
    ).length;
    const bCount = orderedPlayers.filter(
      (p) => normalizeTeamKey(p.team) === 'b',
    ).length;
    const yourTeamName = youTeamKey === 'a' ? aName : bName;
    // Sentence always reads "A vs. B" (alphabetical-ish) regardless of
    // which is the home team. The home team appears at the end via
    // "and you on …".
    const text = `${buildPossessive(aName)} ${aCount} vs. ${buildPossessive(
      bName,
    )} ${bCount} — and you on ${yourTeamName}.`;
    // youAt: only if "you" is in the roster (defensive — drafted Ryder
    // Cup typically includes the user)
    const youAt = youPlayer ? text.lastIndexOf('you') : -1;
    return { text, youAt };
  }

  // ─── Non-Ryder branches (existing behavior) ────────────────────
  const N = orderedPlayers.length;
  const youIncluded = orderedPlayers.some((p) => p.isYou);
  const others = orderedPlayers.filter((p) => !p.isYou);

  if (N === 1 && youIncluded) {
    const text = 'Just you.';
    return { text, youAt: text.lastIndexOf('you') };
  }

  if (N >= 9) {
    const top3 = others.slice(0, 3).map((p) => p.name).join(', ');
    const remaining = others.length - 3;
    if (youIncluded) {
      const text = `${top3}, and ${remaining} others — including you.`;
      return { text, youAt: text.lastIndexOf('you') };
    }
    return { text: `${top3}, and ${remaining} others.`, youAt: -1 };
  }

  if (youIncluded) {
    const text = `${joinNames([...others.map((p) => p.name), 'you'])}.`;
    return { text, youAt: text.lastIndexOf('you') };
  }

  return { text: `${joinNames(others.map((p) => p.name))}.`, youAt: -1 };
}
