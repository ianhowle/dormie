# Match Play family architecture — blueprint + staged build plan

**Status:** Build blueprint. Captures the read-only investigation that mapped how every match-play-shaped piece in the codebase relates, and the risk-inverted sequence to wire match play once for the whole family.

**Sources:** Read-only trace of `src/data/scoring.ts`, `src/services/fourTeamRyder.service.ts`, `src/components/RyderCupHub.tsx`, `src/components/scoring/ScoringModals.tsx`, `src/scoring/useScoringState.ts`. No code touched.

---

## The finding: FOUR parallel match-status implementations

Match-status logic ("2 UP", "1 DOWN", "AS thru 9", "DORMIE", "2&1") is reimplemented in four different files with subtly different feature sets. Each was correct for its caller when added; nobody composed them.

| # | Location | Input | Output | Used by | DORMIE? | "thru N"? | "DOWN"? |
|---|---|---|---|---|---|---|---|
| 1 | `src/data/scoring.ts:712` `calculateMatchPlay` + `:786` `calculateNetMatchPlay` | Raw per-hole scores for two sides (gross or net via optional handicap strokes arrays) | `MatchPlayResult` with `result` string | **Tests only** — not invoked on the live path | ❌ | ❌ (final result only) | ❌ (winner = A\|B\|null) |
| 2 | `src/services/fourTeamRyder.service.ts:108` `evaluateMatch` | Pre-resolved per-hole winners `Record<number, {winner}>` | margin + status + winner | 4-team Ryder Cup scheduling / standings / cup-clinch | ❌ | ❌ | ❌ |
| 3 | `src/components/RyderCupHub.tsx:227` `computeMatchStatus` | Pre-resolved per-hole winners with red/blue labels | status + leader + lead + DORMIE flag + finalResult | **2-team Ryder Cup live scoring** — the existing working live match-play feature | ✅ | ✅ ("ALL SQUARE thru 9") | ❌ (uses leader) |
| 4 | `src/components/scoring/ScoringModals.tsx:492–533` (inline, no extracted function) | Raw `allScores` Map + `matchupOpponent` URL param | Inline-computed status string | **Regular scoring screen's "Matchup" competition tab** (`matchupOpponent` from season-week / league-matchup) | ❌ | ✅ ("3 UP thru 5") | ✅ ("2 DOWN thru 12") |

**The duplication is at the status-formatting / aggregation layer.** All four reimplement: counting holes won per side, lead computation, early-closeout detection (`lead > holesRemaining` → "X & M"), status-string formatting. They diverge only in input shape (raw scores vs pre-resolved hole winners) and in which display niceties they include (DORMIE only in #3, DOWN only in #4, "thru N" in #3 and #4).

**The richest one is #3 (RyderCupHub `computeMatchStatus`).** It has DORMIE, in-progress "thru N" display, and final-result string. It's already wired to a working live UI. It's the closest existing implementation to what v1 1v1 match play needs.

---

## Two-layer model

For 1v1 singles, team match (2v2 aggregate, best-ball-match, alt-shot), and Ryder Cup matches, the scoring cleanly decomposes into two layers:

### Layer A — "what's the side's score on this hole?" (format-dependent)

This is where match formats differ. Per-hole side-score derivation depends on the match format:

| Match format | Side score derivation | Existing engine / state |
|---|---|---|
| Singles 1v1 (gross) | Player's gross score | Direct read from `allScores` |
| Singles 1v1 (net) | Player's gross − per-hole handicap strokes | `handicapStrokes: Map<playerId, Map<holeNumber, strokes>>` already in state (`useScoringState.ts:153–167`) |
| Best-ball match (gross or net) | `min(player1.score, player2.score)` per side | Math exists 3x: `bestBallTeamScores` useMemo at `useScoringState.ts:931–950`; `getEffectiveScores` in `RyderCupHub.tsx:1202–1216` for fourball; `calculateBestBall` in `data/scoring.ts:766` (full-round, not per-hole) |
| Aggregate-team match | `player1.score + player2.score` per side | None — net-new |
| Alt-shot / foursomes match | Single team score entered per hole (one ball, one entry) | Only in `RyderCupHub` via `redTeamScores[hole]` / `blueTeamScores[hole]` — not on regular scoring path |
| Scramble match | Single team score entered per hole | Same as alt-shot |
| Shamble / Pinehurst / Chapman / Greensomes match | Single team score (the format-specific shot-selection UX is upstream of the side score) | Declared in `RyderCupHub` format enum but not differentiated in `getEffectiveScores`; falls through to single-input |

### Layer B — "given per-hole side scores, what's the match state?" (format-independent)

This is identical regardless of how the per-hole side score was derived:

1. Per hole: compare side A vs side B → 'A' / 'B' / 'halved'.
2. Aggregate: holesWonA, holesWonB, holesHalved, holesPlayed.
3. Compute: lead, leader, holesRemaining.
4. Determine state:
   - FINAL (all holes played)
   - CLINCHED (`lead > holesRemaining` mid-round → "X & M")
   - DORMIE (`lead === holesRemaining && lead > 0` mid-round)
   - IN-PROGRESS ("X UP thru N" or "AS thru N")
   - HALVED (all played, lead === 0)
5. Format display string.

**This step is currently duplicated four times.** The architecture builds it ONCE.

---

## The four artifacts

### Artifact 1 — `formatMatchState` (one shared Layer B engine)

Pure utility, new in `src/data/scoring.ts` (or a new `src/data/matchPlay.ts`):

```ts
function formatMatchState(
  holesWonA: number,
  holesWonB: number,
  holesPlayed: number,
  totalHoles: number,
  perspective?: 'A' | 'B',  // for DOWN-formatting (matchup view)
): {
  status: 'FINAL' | 'CLINCHED' | 'DORMIE' | 'AS' | 'UP' | 'DOWN';
  lead: number;
  leader: 'A' | 'B' | null;
  isComplete: boolean;
  /** Mid-round display: "2 UP thru 9", "DORMIE", "AS thru 12" */
  currentDisplay: string;
  /** End-of-match display: "2&1", "1 UP", "AS", "HALVED" */
  finalDisplay: string;
};
```

Emits the union of features all four current implementations need:
- DORMIE state (today only in #3)
- "thru N" formatting (today only in #3 and #4)
- DOWN perspective (today only in #4)
- "X & M" closeout strings (today in #1, #2, #3)
- Final HALVED vs AS distinction (today in #1 and #3)

Returns **both** `currentDisplay` and `finalDisplay` so live banner and post-round summary can pick the right one.

### Artifact 2 — `deriveSideScore` per-format helpers (Layer A)

Small functions, one per match format. Each takes one hole's input and returns a single side-score `number | null` (null = not yet entered).

```ts
// Singles — gross or net
function deriveSinglesSideScore(
  player: PlayerConfig,
  holeScore: HoleScore | undefined,
  handicapStrokesForHole: number,
): number | null;

// Best Ball — gross or net, min of side's player nets
function deriveBestBallSideScore(
  sidePlayerIds: string[],
  holeScores: Map<string, HoleScore>,
  handicapStrokesByPlayer: Map<string, number>,  // pre-resolved for this hole
): number | null;

// Aggregate — gross or net, sum of side's player nets
function deriveAggregateSideScore(
  sidePlayerIds: string[],
  holeScores: Map<string, HoleScore>,
  handicapStrokesByPlayer: Map<string, number>,
): number | null;

// Alt-shot / Scramble / Shamble — single team-entry per hole
function deriveSingleEntrySideScore(
  sideId: string,
  hole: number,
  teamScores: Map<string, Map<number, number>>,
): number | null;
```

The downstream consumer doesn't care which derivation produced the score.

**Where existing engines feed in:** `calculateBestBall` at `data/scoring.ts:766` already does "min per side per hole" math for the full round; `deriveBestBallSideScore` is the per-hole version of that loop body. Same for the inline best-ball math at `useScoringState.ts:931–950` and `RyderCupHub.tsx:1202–1216`.

### Artifact 3 — `useMatchPlayState()` hook (live-path wiring)

The integration point in `src/scoring/`. Given a `matchConfig` plus the existing `allScores` + `handicapStrokes` Maps:

```ts
function useMatchPlayState(
  matchConfig: Match | null,
  allScores: Map<number, Map<string, HoleScore>>,
  handicapStrokes: Map<string, Map<number, number>>,
  holes: HoleData[],
): {
  holeResults: Array<'A' | 'B' | 'halved' | null>;  // null = not played
  matchState: ReturnType<typeof formatMatchState>;
  sideAScoresByHole: (number | null)[];
  sideBScoresByHole: (number | null)[];
} | null;
```

Reads the player score Map → calls the appropriate `deriveSideScore` per hole based on `matchConfig.format` → builds per-hole winners → calls `formatMatchState` → returns the full state for live banner + post-round consumption.

### Artifact 4 — `MatchPlaySetupModal` (forked from `BestBallSetupModal`)

Lives in `src/components/scoring/ScoringModals.tsx`. Same shape as `BestBallSetupModal` at L262: `teams: { team1: string[]; team2: string[] }` + onMoveToTeam1/2 + onStart. Renamed for match-play context (sideA/sideB) and extended:

- **Match format picker** (Singles / Best Ball / Aggregate / Alt-Shot / etc.) — only shown when `players.length >= 4`. For 2 players, only Singles applies; auto-skip the picker.
- **Score mode toggle** (Gross / Net) — defaults to the round's `scoreMode` URL param.
- **Allowance selector** (100% / 90% / 85% / Custom) — defaults 100% (USGA singles) for v1; per-format defaults deferred to v2.

Trigger: when `formatLabel` matches a match-play variant AND `players.length >= 2`, open the modal at round start. Same trigger pattern as the existing `BestBallSetupModal` at `useScoringState.ts:191`.

### Data model

One canonical shape for the whole family:

```ts
type MatchSide = {
  // Optional UX-only fields. Singles: side has one player; "name" can derive from the player.
  name?: string;
  color?: string;
  playerIds: string[];
};

type Match = {
  format: 'singles' | 'best_ball' | 'aggregate' | 'alt_shot' | 'scramble' | 'shamble' | 'pinehurst' | 'chapman' | 'greensomes';
  sideA: MatchSide;
  sideB: MatchSide;
  scoreMode: 'gross' | 'net';
  allowance?: number;  // multiplier on handicap strokes. Default 1.0 (USGA singles).
};
```

Singles 1v1: each side is a one-element `playerIds` array. The engine doesn't branch on player count — `deriveSideScore` does, based on `format`.

---

## What already exists that we reuse

### RyderCupHub has working live team match play (Phase-2 migration target)

`src/components/RyderCupHub.tsx` is a parallel implementation of all of the above for the 2-team Ryder Cup context. Already handles:

- **Match formats:** `foursomes | fourball | singles | shamble | scramble | greensomes` (per `RCFormat` at L48). `fourball` does best-of math in `getEffectiveScores`; `foursomes`/`singles`/`scramble` take a single team-entry per hole; `shamble`/`greensomes` declared but fall through to single-input (not differentiated).
- **Match-state computation:** `computeMatchStatus` at L227 — the richest of the four existing implementations (DORMIE + "thru N" + ALL SQUARE-thru-N).
- **Team-assignment:** `RCMatch.redPlayers: string[]` + `bluePlayers: string[]` — same array-of-player-IDs shape as `bestBallTeams` / `lowHighTeams` on the regular scoring path.
- **Foursomes alternate-shot tee logic:** `foursomesTeeSide(hole)` tells UI which player tees off per hole.

**Ryder Cup is a labeling skin on the family** — same engine, with `red`/`blue` instead of `sideA`/`sideB` plus cup-clinch standings layered on top. In Phase 2, migrate `RyderCupHub` to consume `useMatchPlayState` + `formatMatchState`, replacing `computeMatchStatus` and `getEffectiveScores`. Don't gate v1 on this migration — design the v1 API to be the API Ryder Cup eventually consumes.

### Team-assign UI exists three times

Same `{ team1: string[]; team2: string[] }` shape used by:

- `BestBallSetupModal` at `ScoringModals.tsx:262` (2v2 best ball)
- `LowHighSetupModal` at `ScoringModals.tsx:563` (2v2 low/high)
- `SixSixSixSetupModal` at `ScoringModals.tsx:704` (6-6-6 segments)

Plus the richer `RCMatch.redPlayers/bluePlayers` in `RyderCupHub`. The 2v2 column-picker UX is established and known to work — fork `BestBallSetupModal` for the match-play variant.

### Net / gross already plumbed

- **`scoreMode` URL param** (`'gross' | 'net'`) flows through `useScoringState.ts:78` — consumed at finalize, exposed via `s.scoreMode`. Match play just reads it.
- **`handicapStrokes: Map<playerId, Map<holeNumber, strokes>>`** computed at `useScoringState.ts:153–167` from each player's `handicap` + `courseSlope` + `courseRating` + `coursePar` + each hole's `strokeIndex`. Per-player per-hole strokes — exactly the right shape for `calculateNetMatchPlay`'s `handicapStrokesA / handicapStrokesB` arrays, and for `deriveSideScore` variants.

### Existing engines that feed the new artifacts

- `calculateNetMatchPlay` (`data/scoring.ts:786`) — Layer B for 1v1 singles, gross-or-net. Can be kept; `formatMatchState` is extracted from its tail. Or it can be deleted in Phase 2 once everything calls the new engine.
- `calculateBestBall` (`data/scoring.ts:766`) — full-round best-ball math. `deriveBestBallSideScore` is its per-hole counterpart.
- `bestBallTeamScores` useMemo (`useScoringState.ts:931–950`) — already computes team totals from `bestBallTeams` + `allScores`. Refactor to use `deriveBestBallSideScore` under the hood; behavior unchanged.

---

## RISK-INVERTED build sequence

The investigation report originally suggested a "extract `formatMatchState` first, refactor all four existing implementations to consume it, then build the new path" order. **We're inverting that.** Build the new path FIRST, against a known-working v1 surface; refactor the four existing implementations LAST, against a proven engine.

Rationale: three of the four existing implementations are wired into features users rely on today (Ryder Cup live scoring is real and shipped; the Matchup competition tab is wired to season-week scoring). A botched refactor of a working surface is much more expensive than a botched new-feature wiring. Build the new artifact, prove it serves v1 1v1 singles end-to-end, then bring the existing implementations into the fold from a position of strength.

### Stage 1 — `formatMatchState` + `deriveSinglesSideScore` as NEW code; wire 1v1 only

Touch nothing that works.

- Add `formatMatchState` to `data/scoring.ts` (or `data/matchPlay.ts`) as a brand-new function. Tests cover DORMIE, CLINCHED, "thru N", DOWN perspective, all-square HALVED, early-closeout.
- Add `deriveSinglesSideScore` as a brand-new function. Tests cover gross + net.
- Add `useMatchPlayState` hook in `src/scoring/`. Tests cover the 1v1 wiring against fixture `allScores` Maps.
- **Do not touch:** `calculateMatchPlay`, `calculateNetMatchPlay`, `evaluateMatch`, `computeMatchStatus`, the inline Matchup-tab computation. They keep working unchanged.
- **Do not touch:** RyderCupHub. It keeps working unchanged.

End state: new code exists, tested in isolation, not yet visible to users.

### Stage 2 — `MatchPlaySetupModal` (1v1) + gross/net toggle

- Fork `BestBallSetupModal` to `MatchPlaySetupModal`. Initial scope: 1v1 only (auto-skip the format picker when `players.length === 2`).
- Add the score-mode toggle (Gross / Net), defaulting to the round's `scoreMode`.
- Allowance selector with 100% default; one selectable for v1, more in v2.
- Wire the trigger in `useScoringState`: when `formatLabel.toLowerCase().includes('match play') && players.length === 2`, open the modal at round start (mirroring `BestBallSetupModal` trigger at `useScoringState.ts:191`).
- The modal writes the `Match` config to a new state slice (`matchConfig: Match | null`).
- **Do not touch:** any of the existing four implementations.

End state: a match-play round can be set up. No live or post-round behavior yet.

### Stage 3 — live status banner + isMatchPlay post-round branch

- Live banner above the score grid renders `useMatchPlayState(matchConfig, …).matchState.currentDisplay` — "2 UP thru 9", "DORMIE", "AS thru 12". Mirrors how the Wolf banner and 6-6-6 segment banner render today.
- Add `isMatchPlay = matchConfig !== null` branch to `PostRoundSummary.tsx`, mirroring the existing `isStableford` branch at L786. Render `matchState.finalDisplay` as the headline result.
- Persist `matchConfig` + final `matchState` to the round row (extend `ActiveRoundState` schema).

**End state: 1v1 match play is fully real on the regular scoring path.** Users can pick Match Play in the wizard, get a setup modal, see live match status hole-by-hole, see the final result post-round. Singles works end-to-end.

### Stage 4 — extend to team match (best-ball / alt-shot)

- Add `deriveBestBallSideScore` + `deriveAggregateSideScore` + `deriveSingleEntrySideScore` (for alt-shot/scramble).
- Extend `MatchPlaySetupModal` to show the format picker when `players.length === 4`.
- For alt-shot / scramble: add a `teamScores` state slice that the scoring screen knows to collect (single team entry per hole) when the match format requires it. Analogous to existing `bestBallTeams` / `lowHighTeams` patterns.
- Live banner + post-round branch work unchanged — they consume `useMatchPlayState` regardless of derive variant.

End state: 2v2 team match play is fully real. The whole singles + team match family works on the regular scoring path.

### Phase 2 — consolidate (deferred until the engine is proven)

Done LAST, against a proven engine that has shipped to users.

- Refactor `calculateMatchPlay` and `calculateNetMatchPlay` to consume `formatMatchState` internally. Delete the duplicated status-string code in their tail. Tests still pass.
- Refactor `evaluateMatch` (`fourTeamRyder.service.ts:108`) to consume `formatMatchState`. Standings + cup-clinch logic stays in the Ryder service.
- Refactor `RyderCupHub.computeMatchStatus` to consume `formatMatchState`. Refactor `getEffectiveScores` to call `deriveSideScore` variants. Ryder team-setup pattern eventually adopts `MatchPlaySetupModal` shape (with team-name + color extensions).
- Refactor the Matchup competition tab (`ScoringModals.tsx:492–533`) to consume `useMatchPlayState` with `{ format: 'singles', sideA: [you], sideB: [matchupOpponent] }`. Kill the inline computation. The competition-tab UX stays unchanged.

End state: one shared engine for all four call sites. Zero parallel implementations.

---

## Risk callouts

### DORMIE only when `lead === holesRemaining && holesRemaining > 0`

DORMIE is a meaningful in-progress state distinct from "X UP" — the trailing side cannot win, only halve. Today only `computeMatchStatus` in RyderCupHub emits DORMIE; the other three implementations don't. `formatMatchState` must emit DORMIE in this exact condition. The `holesRemaining > 0` guard prevents the final-hole edge case (with 0 holes remaining, the match is complete, not DORMIE).

### Live banner vs ended-on-hole-N post-round display

The four existing implementations split on this behavior:
- `calculateMatchPlay` (#1) **breaks out of the loop** when the match is clinched and stops counting later holes. Good for post-round "the match ended on hole 14" semantics.
- `computeMatchStatus` (#3) **doesn't break** — computes for all played holes and marks state as FINAL. Good for a live banner that should keep recomputing as the user continues entering scores past the clinch (some users finish the round anyway for handicap / season totals).

`formatMatchState` resolves this by **returning both** `currentDisplay` and `finalDisplay`. Live banner reads `currentDisplay`. Post-round reads `finalDisplay` (which uses the clinch-hole-aware "2&1" form). Both are computed from the same inputs; no behavior split, no caller-side branching.

### USGA allowance defaults deferred to v2

USGA recommends different handicap allowances per match format: 100% for singles, 90% for best ball, 85% for fourball, etc. **v1 default is 100% for all formats with a single selectable selector.** Encoding per-format defaults is real product surface — defer to v2 when per-format allowance UX gets a proper pass. The architecture supports it: `allowance` is a number on `Match`, applied as a multiplier to per-hole handicap strokes upstream of `deriveSideScore`. The engine doesn't change when v2 adds defaults.

### Net match play interacts with low-handicapper-plays-scratch convention

USGA's strict match-play handicap allocation is "lower-handicap player plays at scratch; higher player gets the difference in strokes." `calculateNetMatchPlay` already produces this correctly because `(grossA − strokesA) − (grossB − strokesB) ≡ (grossA − grossB) − (strokesA − strokesB)`. The shared `handicapStrokes` Map is per-player absolute (not difference-based), so the math is symmetric and produces identical hole-by-hole resolution to the strict allocation. Documented in the existing JSDoc at `data/scoring.ts:773–778`. No special handling needed.

### Coupling to Ryder Cup terminology

RyderCupHub uses `red`/`blue` everywhere. The new architecture uses `A`/`B` (or `sideA`/`sideB`) as the canonical model. **Don't introduce red/blue at the engine level.** Ryder Cup's red/blue labels are a UI skin applied by RyderCupHub on top of the side-agnostic engine in Phase 2.

### Coupling to player count

`MatchSide.playerIds: string[]` — singles is a one-element side, team is N-element. The engine doesn't branch on player count. `deriveSideScore` variants branch on `format`. This means singles, 2v2, and hypothetical 3v3-or-larger team formats all share the same plumbing.

### Multi-match-per-round (Ryder-style)

V1 scope: one match per round. Multi-match (e.g., 4 players running two simultaneous singles matches) is real Ryder Cup behavior but adds complexity (per-match config, per-match status banner, per-match post-round result). Deferred. The `Match` data model is single-match shaped. When multi-match lands, the round-level config becomes `matches: Match[]` — RC-style — and the live UI surfaces one match per scoring screen instance OR a small selector. Not v1.

---

## Match formats this architecture supports cleanly

Once Stages 1–4 are built:

| Format | Layer A (deriveSideScore) | Setup | Status |
|---|---|---|---|
| **1v1 singles** (gross or net) | `deriveSinglesSideScore` | Auto-pair if 2 players; else picker | **Stage 3 complete** |
| **2v2 best-ball match** (gross or net) | `deriveBestBallSideScore` (min per side) | 2v2 picker | **Stage 4 complete** |
| **2v2 aggregate match** (gross or net) | `deriveAggregateSideScore` (sum per side) | 2v2 picker | **Stage 4 complete** |
| **2v2 alt-shot / foursomes match** | `deriveSingleEntrySideScore` (one team entry per hole) | 2v2 picker + single-input UI | **Stage 4 complete** |
| **Scramble / shamble / greensomes / Pinehurst / Chapman match** | Same as alt-shot (single team entry per hole) — the format-specific shot-selection UX is upstream of the side score | 2v2 picker + single-input UI | **Stage 4 complete** (shot-selection UX is its own concern, not match-play-specific) |
| **Ryder Cup matches** | Reuse `deriveSideScore` variants; team-setup adopts MatchPlaySetupModal pattern | Existing RC team-assign wizard | **Phase 2 (RC migration)** |
| **Matchup competition tab** (season-week / league matchup) | `deriveSinglesSideScore` | No setup modal (auto-config from `matchupOpponent` URL param) | **Phase 2 (Matchup-tab refactor)** |

---

## Bottom line

**One match-play data model. One Layer B engine. Format-specific Layer A. One setup modal. One live banner. One post-round branch.**

Ryder Cup is a labeling skin. The Matchup competition tab is the simplest case. Both consolidate onto the same engine in Phase 2 — after v1 has proven the architecture in production for 1v1 singles and 2v2 team match.

Build the new path first. Touch nothing that works until you have something that works to replace it with.
