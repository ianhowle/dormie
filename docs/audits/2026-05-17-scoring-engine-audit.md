# Scoring Engine Audit — Dormie

**Purpose:** Definitive map of Dormie's scoring primitives for a future Scoring Engine Integration Sprint. Read-only investigation; no code touched.

**TL;DR:** Of 15 declared formats, **0 have a wired-and-used engine**; the live scoring path treats every format as "track gross/net per hole, sum at the end" regardless of label. Of 17 declared side games, **7 have wired result computation, 10 are theater** ("Results tracked — detailed scoring coming soon"). The wizard's full payout-structure configuration (winner-takes-all, split-top-3, per-point, per-place, etc.) is **captured but never read** by any downstream code. A sophisticated double-entry ledger schema exists but only Nassau ($5 hardcoded) and Skins ($2 hardcoded) actually write to it. Three Stableford implementations and two Match Play implementations exist with subtle behavioral differences.

---

## 1. Engine Inventory — Formats

| Format key | Display | Category | Engine fn | File:line | Wired to useScoringState? | Wired to PostRoundSummary? | Tests? |
|---|---|---|---|---|---|---|---|
| `stroke_play` | Stroke Play | individual | *(none — totals only)* | — | passthrough | passthrough | gross/net helpers only |
| `match_play` | Match Play | individual/team | `calculateMatchPlay` | `src/data/scoring.ts:685` | **❌ orphan** | **❌ orphan** | **❌ none** |
| `stableford` | Stableford | individual | `calculateStablefordPoints` (handicap-aware, per-hole) | `src/data/scoring.ts:592` | **❌ orphan** | **❌ orphan** | ✅ scoring-formats.test.ts:124 |
| `modified_stableford` | Modified Stableford | individual | `calculateModifiedStablefordPoints` + `calculateModifiedStablefordFromRound` | `src/data/scoring.ts:616, 631` | **❌ orphan** | **❌ orphan** | ✅ scoring-formats.test.ts:200 |
| `best_ball` | Best Ball | team | `calculateBestBall` | `src/data/scoring.ts:749` | **❌ orphan** | **❌ orphan** | **❌ none** |
| `scramble` | Scramble | team | `calculateScrambleTeamScore` + `validateScrambleScore` | `src/data/scoring.ts:777, 787` | **❌ orphan** | **❌ orphan** | **❌ none** |
| `alternate_shot` | Alternate Shot | team | *(none)* | — | **theater** | **theater** | — |
| `shamble` | Shamble | team | *(none)* | — | **theater** | **theater** | — |
| `chapman` | Chapman | team | `calculateChapmanHoleScore` + `calculateChapmanTotal` | `src/data/scoring.ts:830, 838` | **❌ orphan** | **❌ orphan** | **❌ none** |
| `fourball` | Four-Ball | team | *(none — comment says "identical to best ball")* | — | **theater** | **theater** | — |
| `greensomes` | Greensomes | team | *(none)* | — | **theater** | **theater** | — |
| `pinehurst` | Pinehurst | team | *(none — comment says "Same engine as Chapman" → would point at orphan)* | — | **theater** | **theater** | — |
| `wolf` | Wolf | mixed | *(format-level: none; side-game-level: `computeWolfPoints` + `buildWolfResult`)* | `src/scoring/calculations.ts:286, 362` | ✅ (as side game) | ✅ (as side game) | **❌ none** |
| `low_high` | Low Ball / High Ball | team | inline in useScoringState | `src/scoring/useScoringState.ts` (LowHigh logic block) | ✅ inline | passthrough (no separate engine) | **❌ none** |
| `sixsixsix` | 6-6-6 | team | inline in useScoringState | `src/scoring/useScoringState.ts:990–1009` | ✅ inline | passthrough | **❌ none** |

**Key finding:** `useScoringState.ts:55, 79` reads `params.format` as a string but uses it **only as a display label** (`formatLabel = params.format ?? 'Total Strokes'`). The state machine never switches on format. Every trip — whether Stableford, Modified Stableford, Best Ball, Chapman, Stroke Play — runs through the **same gross/net-tracking codepath**.

`PostRoundSummary` (`src/components/scoring/PostRoundSummary.tsx`) renders `grossScore` / `netScore` per player as inert numbers. There is no format-specific result rendering (no points totals for Stableford, no match status string for Match Play, no team total for Best Ball/Scramble/Chapman).

---

## 2. Engine Inventory — Side games

| Side game key | Display | Engine fn (PostRoundSummary path) | Wiring source | Live state? | Tests? |
|---|---|---|---|---|---|
| `skins` | Skins | `buildSkinsResult` | `src/scoring/calculations.ts:104` → wired @ `PostRoundSummary.tsx:378` | ✅ + auto-ledger settle ($2 hardcoded) | **❌** |
| `snake` | Snake | `buildSnakeResult` | `calculations.ts:143` → wired @ L379 | ✅ (3-putt detect) | **❌** |
| `greenies` | Greenies | `buildGreeniesResult` | `calculations.ts:168` → wired @ L380 | ✅ (par-3 + GIR) | **❌** |
| `nassau` | Nassau | `buildNassauResult` | `calculations.ts:195` → wired @ L381 | ✅ + auto-ledger settle ($5 hardcoded) | **❌** |
| `dots` | Dots | `buildDotsResult` | `calculations.ts:233` → wired @ L382 | ✅ | **❌** |
| `wolf` | Wolf | `buildWolfResult` + `computeWolfPoints` | `calculations.ts:286, 362` → wired @ L383 | ✅ (per-hole decisions) | **❌** |
| `bingo_bango_bongo` | BBB | `buildBBBResult` | `calculations.ts:380` → wired @ L384 | ✅ (auto/semi-auto detection) | **❌** |
| `sandies` | Sandies | `buildGenericResult` ("coming soon") | fallback @ L386 | ✅ toast prompt (`SideGameToast.tsx:125`) | — |
| `bark` | Barkies | `buildGenericResult` ("coming soon") | fallback | ✅ toast prompt (`SideGameToast.tsx:139`) | — |
| `arnies` | Arnies | `buildGenericResult` ("coming soon") | fallback | ✅ toast prompt (`SideGameToast.tsx:153`) | — |
| `close_shave` | KP | `buildGenericResult` ("coming soon") | fallback | ✅ toast prompt (`SideGameToast.tsx:167`) — needs par-3 metadata | — |
| `poleys` | Poleys | `buildGenericResult` ("coming soon") | fallback | ✅ toast prompt (`SideGameToast.tsx:183`) | — |
| `hammer` | Hammer | `buildGenericResult` ("coming soon") | fallback | ✅ live state (`useScoringState.ts:172, 1169`) | — |
| `three_putt_poker` | 3-Putt Poker | `buildGenericResult` ("coming soon") | fallback | ✅ live ticker w/ pot + worst-putter (`useScoringState.ts:209–217, 1026+`) — **most user-visible theater** | — |
| `trash` | Trash | `buildGenericResult` ("coming soon") | fallback | ❌ no live detection | — |
| `hogans` | Hogans | `buildGenericResult` ("coming soon") | fallback | ❌ no live detection | — |
| `murphys` | Murphys | `buildGenericResult` ("coming soon") | fallback | ❌ no live detection | — |

**Theater anti-pattern severity (per side game):**
- **Tier A (live theater + summary theater):** 3-Putt Poker. The user watches a pot grow during play and sees worst-putter tracked, then gets "coming soon" at round end. Highest perceived betrayal.
- **Tier B (toast prompts only):** sandies, bark, arnies, close_shave (KP), poleys. Toast asks "Did this happen?" — implies tracking — then summary says "coming soon."
- **Tier C (configured but invisible):** trash, hogans, murphys. User selects them in wizard, sees them in stakes config, gets "coming soon" at end with no in-round signal at all. Lowest betrayal because there's no false signal during play.
- **Tier D (live state, no summary):** hammer. State machine tracks per-hole hammer drops, but post-round shows "coming soon."

---

## 3. Duplicate Implementations

### 3a. Stableford × 3

| # | File:line | Function | Handicap-aware? | Input shape | Output | Wired? |
|---|---|---|---|---|---|---|
| 1 | `src/data/scoring.ts:592` | `calculateStablefordPoints(score, par, handicapStrokes)` | ✅ yes | per-hole | per-hole points | **❌ orphan** (tests only) |
| 2 | `src/services/scoring.service.ts:41` | `calculateStablefordFromRound(holeScores, coursePars)` | ❌ no | full round | round total | ✅ wired via `processSeasonRound` → `roundStorage.ts:232` (offline-sync season scoring) |
| 3 | `src/data/__tests__/scoring-formats.test.ts:29` | `calculateStablefordFromRound` (inline copy of #2) | ❌ no | full round | round total | test-isolation hack — comment at L26–27 acknowledges duplication; verifies its own copy, not the production path |

**Subtle bug surface:** #1 takes `handicapStrokes` per hole; #2 ignores handicap entirely. If a future Stableford trip is added to live scoring and a dev grabs #2 by autocomplete, **net Stableford silently degrades to gross Stableford** — a real correctness regression that would not throw any error.

**Test orphaning risk:** #3 is a copy that won't drift detect against #2. If `processSeasonRound`'s Stableford logic changes (e.g., to add handicap), the test won't fail because it's verifying its own private definition.

### 3b. Match Play × 2

| # | File:line | Function | Input shape | Use case | Wired? |
|---|---|---|---|---|---|
| 1 | `src/data/scoring.ts:685` | `calculateMatchPlay(playerAScores, playerBScores)` | two arrays of gross scores | individual head-to-head | **❌ orphan, ❌ no tests** |
| 2 | `src/services/fourTeamRyder.service.ts:108` | `evaluateMatch(holeResults, totalHoles)` | per-hole pre-resolved `{winner: 'team1'|'team2'|'halved'}` records | Ryder Cup multi-team math | ✅ wired (`pointsForMatch`, `computeStandings`, `checkCupClinched` all consume) |

These aren't literal duplicates — different inputs — but they share the same **output vocabulary** (`'2&1'`, `'1 UP'`, `'AS'`, `'HALVED'`). The early-close-out logic (`if (lead > holesRemaining) match ends`) is reimplemented in both. A bug fix in one would not propagate. If `match_play` ever gets wired into live scoring, a dev has to choose between calling #1 (would need score arrays from somewhere) or extracting #2's logic (Ryder-shaped, would need adaptation).

### 3c. Honorable mention — inline `match_play` inside 6-6-6

`useScoringState.ts:997` has a block inside the 6-6-6 segment-scoring switch that reads:

```ts
// match_play: low + high both count; net points settle winner
```

This is **not** related to the `match_play` format key. It's a *scoring method* for a 6-6-6 segment (vs `low_ball` or `combined`). Naming collision — same string ID, different meaning. A future engine consolidation should rename this `mp_segment` or similar to avoid the confusion.

---

## 4. Theater Inventory

### 4a. Format theater (UI exists, no engine produces format-aware results)

All 15 formats render the same Post-Round summary (per-player gross/net totals). For formats whose entire point is non-stroke output (points totals for Stableford, match strings for Match Play, team scores for Best Ball/Chapman/Scramble), this is silent failure:

- **Stableford / Modified Stableford** trips: user expects to see "Drew: 31 pts" — sees "Drew: 78 (−6)" instead.
- **Match Play** trips: user expects to see "Drew d. Jake 2&1" — sees both players' gross totals as if it were stroke play.
- **Best Ball / Fourball / Scramble / Shamble** trips: user expects to see team total — sees individual gross totals.
- **Chapman / Pinehurst / Greensomes / Alternate Shot**: same.
- **Low Ball / High Ball**: useScoringState DOES compute per-hole low+high points inline; PostRoundSummary doesn't render them as a result — they fall under the side-games render path.
- **6-6-6**: useScoringState computes per-segment results inline; ditto.
- **Wolf (as format)**: not really tested as a primary format. The side-game-wolf engine IS wired so Wolf-as-format probably works incidentally via the side-game render path, but the format/side-game distinction is muddled.

### 4b. Side-game theater

Already mapped in §2. Tier A–D severity ranking.

### 4c. Payout-config theater

The wizard's `PerGameStakeInput` captures sophisticated per-game payout configuration:

- **Stableford / Modified Stableford:** `payout: 'per_point' | 'per_place'` (`PerGameStakeInput.tsx:241`)
- **Stroke Play:** `payout: 'winner_takes_all' | 'split_top_3'` (`PerGameStakeInput.tsx:202`)
- **Skins:** `carryOver: boolean` (`PerGameStakeInput.tsx`)
- **Nassau:** `{ front9, back9, total }` three-amount config

All of this is stored on `WizardContext` state as `perGameStakes[gameKey] = { amount, config }` and written to the trip row at `trip.stakes` (a `text` field — likely the cinematic summary string, not the structured config).

**Grep result:** zero downstream consumers of `per_place`, `per_point`, `winner_takes_all`, `split_top_3` outside the wizard itself.

The auto-settle paths in `useScoringState.ts:763–808` hard-code:
- Nassau: `amount: 5` (per loser per segment) — L778
- Skins: `amount: totalSkins * 2 / (players.length - skinsWinners.length)` (each loser pays `$2 × winning_skin` portion) — L799

These ignore the wizard's `perGameStakes.nassau.config.nassau.{front9,back9,total}` and `perGameStakes.skins.config.skins.carryOver`. The skins settlement DOES carry over by checking ties per hole, but doesn't read the wizard's toggle.

**Conclusion:** every payout configuration setting in the wizard is captured-but-unused. The Stableford "Fixed per place" toggle the user flagged is one example of a uniform pattern across all stake configs.

---

## 5. Payout Structure State

### Schema (good — sophisticated foundation)

`supabase/migrations/20260411_ledger.sql` defines a **double-entry ledger:**

- `wagers` — `(id, creator_id, round_id, trip_id, name, type, stakes jsonb, status)` with `type` constrained to `'nassau' | 'skins' | 'match' | 'custom' | 'dots' | 'press' | 'auto_nassau' | 'auto_skins'`
- `wager_participants` — many-to-many with `buy_in`
- `ledger_entries` — `(wager_id, from_user_id, to_user_id, amount, memo, kind, group_key)` — kind ∈ `wager | settlement | adjustment`
- `settlements` — Venmo/Zelle/cash off-ledger receipts
- `user_balances` view — derived sum across entries
- RLS policies for participant-scoped reads

This is **production-quality money infrastructure**. The data model supports per-hole, per-segment, per-game payouts with full auditability and multi-party netting.

### What actually writes to it

`src/services/ledger.service.ts:51+` exposes the API:
- `autoSettleNassau` — wired (`useScoringState.ts:779`) with hardcoded $5/segment
- `autoSettleSkins` — wired (`useScoringState.ts:801`) with hardcoded $2/skin
- Other helpers (`getEntriesForUser`, `getGroupBalances`, `getSimplifiedDebts`) — consumed by `app/ledger.tsx` for the ledger view

**Anything not nassau or skins doesn't create ledger entries.** No `auto_match`, `auto_dots`, `auto_greenies`, etc. on the autoSettle side. The `wagers.type` enum lists `match | custom | dots` as valid types — but no engine creates rows of those types.

### Per-place vs per-point vs winner-take-all logic distribution

- **Captured:** in wizard `state.perGameStakes[gameKey].config`
- **Persisted:** likely as part of the `wagers.stakes jsonb` column (untested — no creator code I could find writes structured stakes during trip-create; trips.tsx and tripsService write a `text` `stakes` field on the `trips` row which appears to be the cinematic summary string)
- **Read:** nowhere

---

## 6. Tiered Integration Plan

### Tier 1 — Wire-up tier (orphan engines that already work and just need importing)

Estimated effort: **~6–10 hours total.**

1. **Wire `calculateStablefordPoints` (handicap-aware) into the live scoring path.** Format-conditional in `useScoringState` so Stableford/Modified Stableford trips compute per-hole points alongside gross/net. Surface in `PostRoundSummary` as a points-total panel. ~2hr.
2. **Wire `calculateMatchPlay` into the live scoring path for `match_play` format.** Render the match string ("2&1", "AS") in PostRoundSummary instead of gross totals. ~2hr.
3. **Wire `calculateBestBall` for `best_ball` + `fourball`.** Same input shape; render team total. Document that fourball uses Best Ball engine per `fourball` description's "identical to best ball" comment. ~1.5hr.
4. **Wire `calculateScrambleTeamScore` + `validateScrambleScore` for `scramble`.** Render team total. Validate calls happen at score-entry boundary. ~1.5hr.
5. **Wire `calculateChapmanTotal` for `chapman` + `pinehurst`.** Map both format keys to the same engine. ~1.5hr.
6. **Wire `calculateBestNHoles`** if any UI offers Best 9/Best 6 (didn't see in audit — may be season-only via `seasons-detail.ts`; check before scoping). ~0.5hr.

Tier 1 unblocks **all 5 format-level Tier-A issues** (Stableford, Match Play, Best Ball/Fourball, Scramble, Chapman/Pinehurst).

### Tier 2 — De-duplication tier (consolidate redundant implementations)

Estimated effort: **~3–5 hours total.**

1. **Consolidate the 3 Stableford implementations.** Decision: pick `calculateStablefordPoints` (#1, handicap-aware) as canonical. Add a `calculateStablefordTotal(holeScores, pars, handicapStrokesPerHole?)` wrapper for the full-round case. Update `processSeasonRound` to call the wrapper instead of inline `calculateStablefordFromRound`. Delete the test-file inline copy and have it import from the canonical module. ~2hr.
2. **Extract `evaluateMatch`'s match-status logic into a shared helper.** Both `calculateMatchPlay` and `evaluateMatch` reimplement the `n&m / n UP / AS` string formatting and the early-close-out logic. Factor to `formatMatchResult(holesWonA, holesWonB, holesPlayed, totalHoles): { winner, margin }`. Have both call it. ~1.5hr.
3. **Rename the 6-6-6 inline `match_play` scoring method.** Avoid collision with the format key. Rename to `mp_segment` or `head_to_head_low_high`. ~0.5hr.

### Tier 3 — New engine tier (formats with no engine anywhere)

Estimated effort: **~12–20 hours total.**

1. **Alternate Shot** — single ball, alternating strokes. Engine takes team partner-pair + hole-by-hole scores; validates alternation pattern; outputs team total. ~3hr.
2. **Shamble** — best drive + individual play. Engine takes team players, hole-by-hole all-players gross scores + selected-drive metadata; outputs team's "best score per hole" using the constraint that everyone played from the selected drive. ~3hr.
3. **Greensomes** — both drive, pick best, alternate from there. Engine takes drives + alternate strokes. ~2hr.
4. **Hammer (side game)** — extract from inline `useScoringState` state into `calculations.ts` engine for testability. Render in PostRoundSummary. ~3hr.
5. **KP (close_shave) — needs course par-3 metadata first.** Blocked by Course Data Quality Sprint (216/324 courses missing per-hole pars). Engine itself is trivial. ~1hr after data unblock.
6. **Sandies / Barkies / Arnies / Poleys** — engines are simple counters. Convert toast prompts into persisted events; aggregate counters at round end; render in PostRoundSummary. ~3hr for all four together.
7. **3-Putt Poker** — engine partially exists (`useScoringState.ts:1026+`). Move pot/worst-putter computation into `calculations.ts`. Wire `buildThreePuttPokerResult` into PostRoundSummary's switch. Highest-leverage Tier 3 task because the live ticker creates the strongest expectation of a summary result. ~2hr.

### Tier 4 — Payout structure overhaul

Estimated effort: **~8–14 hours total.**

1. **Persist structured `perGameStakes` to a new column or `wagers.stakes jsonb`.** Define schema for the JSON payload. Migrate WizardContext write path. ~3hr.
2. **Read structured stakes in `autoSettleNassau`** — replace hardcoded $5 with `wager.stakes.nassau.{front9,back9,total}`. ~1.5hr.
3. **Read structured stakes in `autoSettleSkins`** — replace hardcoded $2 with configured amount; honor carry-over toggle. ~1.5hr.
4. **Implement `autoSettleStableford`** — read `payout: 'per_point' | 'per_place'`; for per-point compute `amount × (pointsWinner − pointsAvg)`; for per-place use top-3 split or winner-takes-all. ~2hr.
5. **Implement `autoSettleStrokePlay`** — read `payout: 'winner_takes_all' | 'split_top_3'`; create paired ledger entries. ~2hr.
6. **Add `wagers.type` enum values** for the new auto-settle types; migration. ~0.5hr.
7. **Expand ledger view UI** if needed to show structured wager breakdown. ~1.5hr.

Tier 4 should follow Tier 1 (engines need to exist before stakes can apply to them) but can run in parallel with Tier 3.

### Recommended sequencing

```
[Tier 1] Wire orphans → unblocks Stableford/Match Play/Best Ball/Scramble/Chapman immediately
  ↓
[Tier 2] De-duplicate → cheap, prevents future bugs from drift
  ↓
[Tier 4] Payout structure → makes the wizard's stakes config actually do something
  ↓
[Tier 3] New engines → longest tail, lowest user expectations because no live theater exists yet (except 3-Putt Poker, which should be promoted)
```

**3-Putt Poker should jump the queue** from Tier 3 to immediately after Tier 1 because it has the strongest live-theater betrayal pattern.

---

## 7. Risk Flags

### Sharp edges that may bite a future implementation sprint

1. **Two `PostRoundSummary` files coexist.** `src/components/PostRoundSummary.tsx` (786 lines) is dead component code — only its `HoleResult` type is referenced (by `RoundStatsCard.tsx`). The live one is `src/components/scoring/PostRoundSummary.tsx`. A naive grep-and-edit might touch the wrong file. Recommend: rename dead file to `_legacy_PostRoundSummary.tsx` or extract the `HoleResult` type to a shared `types.ts` and delete the dead file.

2. **`useScoringState.ts:55` reads `params.format` but never branches on it.** Anyone adding format-aware behavior needs to know this and decide where to switch (engine selection probably belongs in the round-finalize handler at ~L750+, not the keystroke handler).

3. **Handicap-aware vs gross-only Stableford is silent.** A junior dev wiring up Stableford for trips might grab `calculateStablefordFromRound` from scoring.service.ts (it's the one already imported in test files) and miss that it ignores handicap. The seasons path is gross-by-design (season-scope leveling happens elsewhere); the trip path needs handicap-aware. Add a JSDoc warning on both functions explicitly.

4. **6-6-6 segment "match_play" mode collides naming-wise with `match_play` format key.** Cleanup before wiring `match_play` as a primary format, or rename the segment-scoring constant.

5. **`pinehurst` description claims "Same engine as Chapman"** but Chapman's engine is itself orphan. Wiring will need to map both keys to the same engine module — easy to forget.

6. **Course par-3 metadata is the bottleneck for KP (close_shave).** Per the composted Course Data Quality Sprint, 216/324 courses lack per-hole data. KP engine itself is trivial; the data dependency is the blocker. Phase 4 KP work should be sequenced after that sprint.

7. **`wagers.stakes jsonb` is unstructured today.** Tier 4 needs a defined schema for the JSON payload to avoid drift between wizard write shape and ledger read shape. Recommend Zod or io-ts validation at the boundary.

8. **No tests for `calculateMatchPlay`, `calculateBestBall`, `calculateScrambleTeamScore`, `validateScrambleScore`, `calculateChapmanHoleScore`, `calculateChapmanTotal`.** When Tier 1 wires them, ship tests in the same commit — these are the highest-leverage tests in the codebase because they'll cover every team-format round.

9. **`buildBBBResult` consumes `bbbHolePoints` state from useScoringState but that state may be empty** if the user didn't touch the per-hole BBB modal during the round. Need to verify the empty-state fallback. (Couldn't trace deeply without running the app.)

10. **Auto-settle is gated on `players.length >= 2`** (`useScoringState.ts:761`). Solo rounds skip ledger entirely — correct, but also means a 1-player Skins trip silently doesn't settle (Skins is mathematically nonsensical solo, so probably fine; flag in case Tier 4 surfaces it).

11. **The `wagers.type` enum at L11 of the ledger migration** lists `'press'` but I saw no `press` engine or wizard option anywhere — likely planned but never built. Tier 4 should reconcile.

12. **`processSeasonRound` is called from `roundStorage.ts:232` via dynamic import** (`await import('../services/scoring.service')`). The dynamic import is to defer the supabase load. This is fine but worth knowing — the season Stableford computation is one of the few paths where a `calculateStableford*` function genuinely runs in production today.

### Surprises

- **The double-entry ledger schema is significantly more sophisticated than the engines that feed it.** The data model is production-ready; the producers are MVPs. This is the opposite of the usual "schema is the bottleneck" situation. Suggests the ledger work was speculatively built ahead of integration. Good for Tier 4 — the foundation is solid.
- **The Quick Trip wizard's payout-structure UI exists in finished form** (Step 6 polish shipped tonight) **but nothing reads its output.** Highest-impact Tier 4 work because users have already been configuring stakes that don't apply to anything beyond Nassau/Skins.
- **3-Putt Poker has the most code investment of any "theater" side game** (poker deck shuffling, card dealing, hand evaluation via `poker.service.ts`, live ticker UI). Of all the theater paths, it's the closest to "just wire up the result computation" — the live state is already exhaustive.
- **`calculations.ts` line 1 header comment** ("Scoring calculations: Stableford, match play, skins, dots, snake, nassau, settlement") **lists Stableford and match play** but the file contains neither. The comment was aspirational and never updated.

---

## 8. One-page executive summary

**Engines that exist and are used (the working set):**
Nassau, Skins, Snake, Greenies, Dots, Wolf (side-game), BBB. Plus inline Low/High and 6-6-6. Plus Stableford (gross-only, season path only). Plus the Ryder Cup match evaluator.

**Engines that exist and aren't used (orphans, ~10 functions):**
Stableford (handicap-aware per-hole), Modified Stableford (both flavors), Best N Holes, Match Play, Best Ball, Scramble (engine + validator), Chapman (per-hole + total).

**Formats with no engine anywhere:**
Stroke Play (intentional — passthrough is correct), Alternate Shot, Shamble, Fourball (described as Best Ball), Greensomes, Pinehurst (described as Chapman), Wolf-as-format, Low/High (engine is inline), 6-6-6 (engine is inline).

**Side games with no result computation (theater):**
Sandies, Barkies, Arnies, KP, Poleys, Hammer, 3-Putt Poker, Trash, Hogans, Murphys (10 of 17).

**Payout structure:**
Captured exhaustively by the wizard. Read by nothing. Auto-settle hardcodes Nassau $5 / Skins $2.

**Test coverage:**
Solid for Stableford + Modified Stableford + Best N Holes + handicap math. Zero coverage on Match Play, Best Ball, Scramble, Chapman, any side-game engine.

**Total estimated sprint scope (Tiers 1–4):**
**~30–50 hours** depending on test-writing thoroughness and Tier 3 scope. **Tier 1 alone (~6–10 hours) unblocks the 5 most-painful format theater bugs and is the highest leverage starting point.**

---

End of audit. All findings derived from read-only inspection of `src/data/scoring.ts`, `src/scoring/{useScoringState,calculations,sideGames,types}.ts`, `src/components/{,scoring/}PostRoundSummary.tsx`, `src/components/SideGameToast.tsx`, `src/services/{scoring,fourTeamRyder,ledger}.service.ts`, `src/components/wizard/{PerGameStakeInput,perGameStakeTypes}.{ts,tsx}`, `src/components/wizard/quick-trip/WizardContext.tsx`, `supabase/migrations/20260411_ledger.sql`, `src/data/__tests__/scoring-formats.test.ts`, and various callsite greps. No files modified, no git operations performed.
