// ─── Team-Handicap Rules Engine ──────────────────────────────────────
// Pure, deterministic computation of a team handicap scalar from
// individual player handicaps + a rule object. Centralizes the
// weighting/combining logic for team formats (Scramble, Chapman,
// Pinehurst, Greensomes, Alternate Shot / Foursomes).
//
// INPUT — `number[]` of player handicaps. The engine is agnostic to
// which scalar the caller passes (course handicap or WHS handicap
// index); the meaning of the output mirrors the meaning of the input.
//
// OUTPUT — decimal `number`. The engine does NOT round. USGA stroke
// allocation operates on integers, but rounding inside the engine
// loses precision useful for display ("Team handicap: 5.2"). Caller
// rounds at the persistence/UI layer.
//
// RULES — TeamHandicapRule has two methods:
//   { method: 'weighted', weights: [...] }
//     Sorts handicaps ascending (low first), zips with weights[i],
//     sums the products. Low handicap conventionally gets the largest
//     weight — see preset table.
//   { method: 'combined', combinedPercent: N }
//     Sums all handicaps and multiplies by combinedPercent / 100.
//     For 50% × (h_low + h_high) this resolves to the textbook
//     Alt Shot average; extends naturally to N players.
//
// SNAPSHOT CONTRACT — load-bearing.
//   This function is PURE and is intended to be called ONCE at
//   round-start. The caller MUST snapshot the result into round state
//   alongside the resolved rule and the source player handicaps, and
//   MUST NOT wire it into any live-recompute path — not during the
//   round, not after score edits, not after a GHIN sync. A team
//   handicap that drifts mid-round is a bug class: players accrue
//   strokes against a moving target. Enforcement lives at the caller
//   (round / persistence layer); the engine documents the contract.
//
// CUSTOM RULES — callers may construct any TeamHandicapRule object
// directly and pass it to calculateTeamHandicap; preset lookup is
// optional. The override-UI work is purely a wizard layer that builds
// custom rule objects — the engine accepts them identically to presets.

export type TeamHandicapRule =
  | { method: 'weighted'; weights: number[] }
  | { method: 'combined'; combinedPercent: number };

// Internal rule constants — single source of truth. Chapman and
// Pinehurst reference the same object (USGA treats them as the same
// game; one identifier should never diverge from the other).
const SCRAMBLE_2P: TeamHandicapRule = { method: 'weighted', weights: [0.35, 0.15] };
const SCRAMBLE_4P: TeamHandicapRule = { method: 'weighted', weights: [0.25, 0.20, 0.15, 0.10] };
const CHAPMAN_PINEHURST: TeamHandicapRule = { method: 'weighted', weights: [0.60, 0.40] };
const GREENSOMES: TeamHandicapRule = { method: 'weighted', weights: [0.60, 0.40] };
const ALTERNATE_SHOT: TeamHandicapRule = { method: 'combined', combinedPercent: 50 };

/**
 * Preset table keyed by format. Scramble is split into 2P and 4P
 * variants; `teamHandicapForFormat` dispatches on `handicaps.length`
 * when the caller passes the bare 'scramble' format key.
 *
 * For other team sizes — pass a custom TeamHandicapRule. The 4P
 * default (25/20/15/10) is one of several valid conventions; see the
 * compost entry for alternatives (20/15/10/5, 35/20/10/5).
 */
export const TEAM_HANDICAP_PRESETS = {
  scramble_2p: SCRAMBLE_2P,
  scramble_4p: SCRAMBLE_4P,
  chapman: CHAPMAN_PINEHURST,
  pinehurst: CHAPMAN_PINEHURST,
  greensomes: GREENSOMES,
  alternate_shot: ALTERNATE_SHOT,
} as const;

/**
 * Compute a team-handicap scalar from individual handicaps + a rule.
 *
 * Empty handicaps array returns 0 — plausible transient state (e.g.
 * team formation in progress), not a programming bug.
 *
 * Throws on:
 *   - weighted rule whose weights.length !== handicaps.length
 *     (caller bug — rule must match team shape)
 */
export function calculateTeamHandicap(handicaps: number[], rule: TeamHandicapRule): number {
  if (handicaps.length === 0) return 0;
  if (rule.method === 'weighted') {
    if (rule.weights.length !== handicaps.length) {
      throw new Error(
        `Team-handicap weighted rule mismatch: ${rule.weights.length} weights vs ${handicaps.length} handicaps`,
      );
    }
    const sorted = [...handicaps].sort((a, b) => a - b);
    let total = 0;
    for (let i = 0; i < sorted.length; i++) total += sorted[i] * rule.weights[i];
    return total;
  }
  // combined
  const sum = handicaps.reduce((a, b) => a + b, 0);
  return sum * (rule.combinedPercent / 100);
}

/**
 * Resolve a format key to its preset rule, then compute.
 *
 * Scramble dispatches on handicaps.length (2 → scramble_2p,
 * 4 → scramble_4p). Other team sizes for Scramble — call
 * calculateTeamHandicap with a custom rule directly.
 *
 * Throws on:
 *   - Unknown format key (caller bug; fail loud)
 *   - Scramble with a team size that has no preset
 */
export function teamHandicapForFormat(handicaps: number[], formatKey: string): number {
  let rule: TeamHandicapRule | undefined;
  if (formatKey === 'scramble') {
    if (handicaps.length === 2) rule = TEAM_HANDICAP_PRESETS.scramble_2p;
    else if (handicaps.length === 4) rule = TEAM_HANDICAP_PRESETS.scramble_4p;
    else {
      throw new Error(
        `No Scramble preset for ${handicaps.length}-player team — pass a custom TeamHandicapRule`,
      );
    }
  } else {
    rule = (TEAM_HANDICAP_PRESETS as Record<string, TeamHandicapRule | undefined>)[formatKey];
    if (!rule) {
      throw new Error(`No team-handicap preset for format '${formatKey}'`);
    }
  }
  return calculateTeamHandicap(handicaps, rule);
}
