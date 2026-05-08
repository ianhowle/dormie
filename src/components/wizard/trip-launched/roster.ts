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

// =============================================================
// Phase 1.9f exports — adaptive time, fire-floor, duration, stakes
// =============================================================

const MONTH_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
const MONTH_FULL = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatTime12h(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${h12}:${mm} ${ampm}`;
}

export interface AdaptiveTimeInput {
  /** Trip start date — required. */
  startDate: Date;
  /** Trip end date — present for multi-day trips, omitted for single-
   *  day. Triggers the range form when set. */
  endDate?: Date;
  /** Override for "now" — defaults to current wall clock. Useful for
   *  storybook / preview environments and unit tests. */
  now?: Date;
  /** Optional explicit tee time in "HH:MM" 24-hour format. When
   *  provided, forces tee-time mode regardless of date proximity:
   *  primary = formatted tee time ("9:30 AM"), secondary = relative
   *  date label (TODAY / TOMORROW / "OCT 15" / "OCTOBER 2026").
   *  Used by the Quick Trip wizard's Step 2 enhancement (Phase 2.9)
   *  where the user can pick a tee time pill independently of how
   *  far out the date is. */
  teeTime?: string | null;
}

/** Builds the adaptive time strings (primary + optional secondary)
 *  per the spec's three-mode logic:
 *    < 24h     → teeTime mode    ("8:42 AM" · "TODAY"/"TOMORROW")
 *    < 30 days → dateRange mode  ("OCT 15 – 17" · "2026")
 *    ≥ 30 days → countdown mode  ("T-127 DAYS" · "OCTOBER 2026")
 *
 *  Returns null when startDate is invalid (caller should treat as
 *  below-floor and disable the Launch button).
 */
export function buildAdaptiveTime(
  input: AdaptiveTimeInput,
): { primary: string; secondary?: string } | null {
  if (!isValidDate(input.startDate)) return null;
  const start = input.startDate;
  const end =
    input.endDate && isValidDate(input.endDate) ? input.endDate : undefined;
  const now = input.now ?? new Date();

  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_MONTH = 30 * ONE_DAY;
  const msUntil = start.getTime() - now.getTime();

  // Explicit tee-time override — user picked a time pill. Forces
  // tee-time mode regardless of date proximity. Primary is the
  // formatted clock time; secondary is a relative date label that
  // mirrors the existing < 24h branch's TODAY/TOMORROW semantics
  // and extends to MMM D / MONTH YEAR for further-out dates.
  if (input.teeTime) {
    const m = input.teeTime.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (
        Number.isFinite(hh) && Number.isFinite(mm) &&
        hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59
      ) {
        const combined = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
          hh,
          mm,
          0,
          0,
        );
        const startMid = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
        );
        const todayMid = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const daysDiff = Math.round(
          (startMid.getTime() - todayMid.getTime()) / ONE_DAY,
        );
        let secondary: string;
        if (daysDiff === 0) {
          secondary = 'TODAY';
        } else if (daysDiff === 1) {
          secondary = 'TOMORROW';
        } else if (daysDiff > 0 && daysDiff < 30) {
          secondary = `${MONTH_ABBR[start.getMonth()]} ${start.getDate()}`;
        } else {
          secondary = `${MONTH_FULL[start.getMonth()]} ${start.getFullYear()}`;
        }
        return { primary: formatTime12h(combined), secondary };
      }
    }
    // Invalid teeTime string — fall through to date-only logic.
  }

  // Tee-time mode (< 24h): clock time + TODAY/TOMORROW label
  if (msUntil < ONE_DAY && msUntil >= 0) {
    const primary = formatTime12h(start);
    const secondary = isSameDay(start, now) ? 'TODAY' : 'TOMORROW';
    return { primary, secondary };
  }

  // Date-range mode (< 30 days): MMM D / MMM D – D / MMM D – MMM D
  if (msUntil < ONE_MONTH && msUntil >= 0) {
    const startMonth = MONTH_ABBR[start.getMonth()];
    const startDay = start.getDate();
    const year = `${start.getFullYear()}`;
    if (!end || isSameDay(start, end)) {
      // Single-day trip — no range dash
      return { primary: `${startMonth} ${startDay}`, secondary: year };
    }
    if (isSameMonth(start, end)) {
      // Same-month optimization: drops the second month abbrev
      return {
        primary: `${startMonth} ${startDay} – ${end.getDate()}`,
        secondary: year,
      };
    }
    // Cross-month range
    return {
      primary: `${startMonth} ${startDay} – ${MONTH_ABBR[end.getMonth()]} ${end.getDate()}`,
      secondary: year,
    };
  }

  // Countdown mode (≥ 30 days): T-NN DAYS · MONTH YEAR
  const days = Math.ceil(msUntil / ONE_DAY);
  const primary = `T-${days} DAYS`;
  const secondary = `${MONTH_FULL[start.getMonth()]} ${start.getFullYear()}`;
  return { primary, secondary };
}

export interface FireFloorInput {
  /** At least one of destination / tripName / region must be non-empty. */
  destination?: string;
  tripName?: string;
  region?: string;
  /** Trip start date — required Date object. "TBD" / null / undefined
   *  all fail the time check. */
  startDate?: Date;
  /** Roster — solo (length 1) is valid; empty array fails. */
  players?: TripLaunchedPlayer[];
}

export interface FireFloorResult {
  ok: boolean;
  /** When ok=false, indicates which signal failed first. Consumers can
   *  surface "Add a {reason} to launch" copy. */
  reason?: 'identity' | 'time' | 'people';
}

/** Validates the spec's three required signals (identity / time /
 *  people) before the cinematic is allowed to fire. The caller should
 *  use this to gate the Launch button enable state — when ok=false,
 *  disable with explanatory copy keyed off `reason`.
 *
 *  The component itself also checks this defensively and returns null
 *  if called below floor (storybook / preview safety). */
export function meetsFireFloor(input: FireFloorInput): FireFloorResult {
  const hasIdentity = !!(
    (input.destination && input.destination.trim()) ||
    (input.tripName && input.tripName.trim()) ||
    (input.region && input.region.trim())
  );
  if (!hasIdentity) return { ok: false, reason: 'identity' };
  if (!isValidDate(input.startDate)) return { ok: false, reason: 'time' };
  if (!input.players || input.players.length === 0) {
    return { ok: false, reason: 'people' };
  }
  return { ok: true };
}

export interface TotalDurationInput {
  players: TripLaunchedPlayer[];
  format?: string;
  ryderTeams?: RyderTeams;
}

/** Returns the wall-clock time (ms from cinematic start) at which Beat
 *  4's CTA becomes interactive — i.e., when the moment is "fully
 *  presented." Callers can use this to schedule cleanup, follow-up
 *  routing, or analytics events.
 *
 *  Constants below mirror tokens.jsx and the runEntrance scheduling
 *  inside DormieMomentTripLaunched.tsx. Keep in sync when timing
 *  tokens change. */
export function computeTotalDuration(input: TotalDurationInput): number {
  const ryderState = detectRyderState(
    input.players,
    input.format,
    input.ryderTeams,
  );
  const orderedPlayers = orderPlayersForRail(input.players, ryderState);
  const roster = computeRoster(orderedPlayers, ryderState);
  const sentence = buildSentence(orderedPlayers, ryderState, input.ryderTeams);

  // Mirror tokens.beats.momentum.avatarRollCall + sentenceTypeOn
  const FIRST_AVATAR_START = 2500;
  const PER_AVATAR_DURATION = 320;
  const SENTENCE_START_DELAY = 200;
  const MS_PER_CHAR = 30;
  const MAX_SENTENCE_DURATION = 800;
  const UNDERLINE_DELAY = 200;
  const UNDERLINE_DURATION = 380;
  const BEAT4_CTA_OFFSET = 600;

  const FIRST_LAND = FIRST_AVATAR_START + PER_AVATAR_DURATION;
  const lastLandAt =
    roster.variant === 'solo'
      ? FIRST_LAND
      : FIRST_AVATAR_START +
        (orderedPlayers.length - 1) * roster.cadence +
        PER_AVATAR_DURATION;
  const sentenceStartAt = lastLandAt + SENTENCE_START_DELAY;
  const sentenceDurMs =
    sentence.text.length > 0
      ? Math.min(sentence.text.length * MS_PER_CHAR, MAX_SENTENCE_DURATION)
      : 0;
  const sentenceEndAt = sentenceStartAt + sentenceDurMs;
  const beat3EndAt =
    sentence.youAt >= 0
      ? sentenceEndAt + UNDERLINE_DELAY + UNDERLINE_DURATION
      : sentenceEndAt;
  return beat3EndAt + BEAT4_CTA_OFFSET;
}

/** Default stakes line when the caller doesn't provide one explicitly.
 *  Solo + non-Ryder → "QUIET ROUND · NO STAKES". Ryder Cup branches
 *  to undrafted ("RYDER CUP · DRAFT PENDING") or drafted ("RYDER CUP ·
 *  6 vs 6"). Everything else falls to the spec's fire-floor language
 *  "GAME TBD". */
export function defaultStakes(
  format?: string,
  players?: TripLaunchedPlayer[],
  ryderTeams?: RyderTeams,
): string {
  const ryderState = detectRyderState(players ?? [], format, ryderTeams);
  if (ryderState === 'undrafted') return 'RYDER CUP · DRAFT PENDING';
  if (ryderState) {
    // drafted-default | drafted-custom
    return 'RYDER CUP · 6 vs 6';
  }
  if (players && players.length === 1) return 'QUIET ROUND · NO STAKES';
  return 'GAME TBD';
}

