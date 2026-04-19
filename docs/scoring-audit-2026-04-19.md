# Dormie Scoring System Audit

**Date:** 2026-04-19
**Scope:** Full scoring pipeline — engine core, all formats, side games, season integration, offline behavior, ledger/wager integration
**Status:** Read-only investigation. No code changes made.

---

## 1. SCORING ENGINE CORE

### Files Audited
- `src/scoring/useScoringState.ts` — Main state hook (~1034 lines)
- `src/services/scoring.service.ts` — Stableford calculation + season write (~137 lines)
- `src/lib/roundStorage.ts` — Active round persistence + offline queue (~282 lines)
- `src/scoring/calculations.ts` — Side game result builders (~425 lines)
- `src/scoring/moments.ts` — DormieMoment detection (~103 lines)
- `src/scoring/wolfPoints.ts` — Wolf point calculation

### Findings

**🔴 CRITICAL — Offline round queues empty holeScores array**
`useScoringState.ts:769` — When `roundsService.create()` throws (network failure), the offline queue stores `holeScores: [] as any[]` instead of the actual hole-by-hole scores from the `holeScores` variable computed at lines 673-677. When synced later via `syncOfflineRounds` (roundStorage.ts:211), the round is created with zero hole detail. This breaks handicap calculations, stats tracking, and season round processing.

**🔴 CRITICAL — seasonWeekId and seasonId set to same value**
`useScoringState.ts:739-740` — Both fields are set to `ls.seasonId`. The `processSeasonRound` function signature (scoring.service.ts:46-50) treats these as distinct: `seasonWeekId` identifies a specific week, `seasonId` identifies the parent season for config lookup. Passing the same ID causes season config lookup (line 85-90) to potentially fail or return wrong config, breaking multi-round week calculations.

**🟡 WARNING — Missing dependencies in auto-save useEffect**
`useScoringState.ts:312` — Dependency array is `[allScores, currentHoleIdx]` but the effect body reads `courseName`, `courseId`, `coursePar`, `courseSlope`, `courseRating`, `courseTee`, `players`, `formatLabel`, `scoreMode`, `holeRange`, `linkedSeasons`, `sideGameKeys`, `passedHoleData`, `roundType`, and `holes.length`. Stale closure risk: if any of these change mid-round, the auto-saved state won't reflect it.

**🟡 WARNING — Race condition in handlePostRound**
`useScoringState.ts:670-779` — Performs sequential async operations: (1) save round, (2) process seasons, (3) fetch course rounds for personal best, (4) clear active round. If the user navigates away or network drops between steps 1 and 4, the round is saved but the active round isn't cleared, leading to a phantom "resume round" on next app open.

**🟡 WARNING — Silent catch block swallows all season errors**
`useScoringState.ts:744` — `catch {}` with no logging or user notification. If `processSeasonRound` fails due to RLS violation, missing config, or constraint failure, the round saves but season scoring is silently broken. User gets no feedback.

**🟡 WARNING — Poker moment can fire multiple times for same hand**
`useScoringState.ts:1011-1032` — The `setDormieMoment` guard checks `if (prev.visible) return prev` but doesn't track which hands have already triggered moments. If a moment dismisses before the effect re-runs, the same hand triggers again. No deduplication state exists.

**⚪ NOTE — console.error calls in roundStorage.ts**
`roundStorage.ts:91, 147` — Appropriate for debugging but may leak sensitive error info in production. Already scoped with `[roundStorage]` prefix.

**⚪ NOTE — Excessive `as any` type casts in season processing**
`scoring.service.ts:92, 109, 114, 118` — Bypasses TypeScript safety. If Supabase schema changes, these casts hide errors until runtime.

---

## 2. SCORING FORMATS

### Files Audited
- `src/data/scoring.ts` — Format definitions + per-hole calculations (~268 lines)
- `src/scoring/useScoringState.ts` — All format state + calculations
- `src/scoring/wolfPoints.ts` — Wolf point engine
- `src/scoring/moments.ts` — DormieMoment triggers
- `src/data/__tests__/scoring-formats.test.ts` — 48 test cases

### a. Stroke Play (Gross and Net)

**✅ PASS — Gross calculation correct**
`useScoringState.ts:678` — `grossTotal = holeScores.reduce((sum, h) => sum + h.gross, 0)`. Straightforward sum.

**✅ PASS — Net calculation correct**
`useScoringState.ts:681-684` — `netTotal = grossTotal - sumOfHandicapStrokes`. Uses WHS-compliant per-hole handicap stroke allocation (lines 148-162): `courseHcp = round(hcpIndex * (slope/113) + (courseRating - par))`, with +1 if courseHcp >= strokeIndex, +1 if courseHcp >= 18+strokeIndex.

**✅ PASS — Supabase write**
Writes `gross_score` and `net_score` (when scoreMode = 'net') to `rounds` table. Verified at lines 715-731.

### b. Stableford

**✅ PASS — Standard Stableford calculation correct**
`scoring.ts:124-133` — `calculateStablefordPoints(score, par, handicapStrokes)`:
- Par 4, Score 5, HCP 0 → diff = 1 → 1 point (bogey) ✓
- Par 4, Score 3, HCP 0 → diff = -1 → 3 points (birdie) ✓
- Full point scale: 0/1/2/3/4/5 for double bogey+/bogey/par/birdie/eagle/albatross+ ✓

**✅ PASS — Modified Stableford implemented separately**
`scoring.ts:148-158` — Aggressive scale: -5/-3/-1/0/+2/+5/+8. Can produce negative totals. Verified with test cases.

**✅ PASS — 48 test cases all passing**
Test file covers standard, modified, stroke play net/gross, quota, best 9, and cross-format comparisons.

### c. Match Play

**✅ PASS — Dormie detection correct**
`moments.ts:52` — `if (lead > 0 && lead === holesRemaining)` triggers DORMIE. Verified: 3 UP with 3 holes remaining → `lead = 3, holesRemaining = 3` → TRUE. Returns `{ type: 'DORMIE', detail: '3 up with 3 to play' }` with haptics and chime.

**✅ PASS — Match close detection**
`moments.ts:61-68` — `if (lead > holesRemaining)` triggers MATCH_CLOSED. 3 UP with 2 remaining → "3&1".

**✅ PASS — Match end logic**
`scoring.ts:242-246` — Match ends when `lead > holesRemaining`. Result formats: "2&1", "1 UP", "AS"/"HALVED".

### d. Skins

**✅ PASS — Carryover logic correct**
`calculations.ts:104-141` — If hole is tied → `carryover++`. Winner claims `1 + carryover` skins. H1 tied, H2 winner → winner gets 2 skins ✓. Carryover resets to 0 after each winner.

**✅ PASS — Jackpot moment**
`moments.ts:87-94` — When `carryover >= 3`, triggers SKINS_JACKPOT moment with detail `"${carryover + 1} skins won on Hole ${h.number}!"`.

**⚪ NOTE — Skins results not persisted to dedicated table**
Calculated dynamically from `hole_scores` on round view. No separate skins result table. Acceptable for now but limits historical skins queries.

### e. Nassau

**✅ PASS — Three-segment calculation correct**
`calculations.ts:195-231` — Front 9 (holes 1-9), Back 9 (holes 10-18), Overall (all 18). Each segment independently determines winner by lowest total.

**✅ PASS — Settlement calculation in PostRoundSummary**
`PostRoundSummary.tsx:435-461` — $5 per bet x 3 segments. Correct greedy debt simplification.

### f. Wolf

**✅ PASS — Point calculations verified**
`wolfPoints.ts:20-67`:

| Scenario | Wolf | Partner | Each Opponent |
|----------|------|---------|---------------|
| Partner Win | +2 | +2 | -1 |
| Partner Loss | -1 | -1 | +2 |
| Lone Win | +3 | N/A | -1 |
| Lone Loss/Tie | -3 | N/A | +1 |
| Blind Win | +6 | N/A | -2 |
| Blind Loss/Tie | -6 | N/A | +2 |

Points net to zero across all players per hole ✓. Blind wolf properly doubles stakes ✓. Ties go against the wolf ✓.

### g. BBB (Bingo Bango Bongo)

**✅ PASS — Three categories each worth 1 point**
`useScoringState.ts:487-541`:
- Bingo (first on green): Auto-detected via GIR ✓
- Bango (closest to pin): Semi-auto prompt ✓
- Bongo (first to hole out): Auto-detected via lowest gross ✓

**✅ PASS — Triple Crown moment**
`useScoringState.ts:523-535` — Same player gets all three on one hole → BBB_TRIPLE_CROWN with heavy haptic + chime.

### h. Low Ball / High Ball

**✅ PASS — Team format + scoring correct**
`useScoringState.ts:804-888` — Strictly 2v2. Low ball = best score per team compared. High ball = worst score per team compared. Birdie bonus (+1) when winning low is under par. Three tie handling modes: halve (0.5), carryover, no_point.

**✅ PASS — CLEAN_SWEEP moment**
`useScoringState.ts:577-599` — Triggers when same team wins both low AND high on same hole. Verified condition: `lowWin !== 'halved' && lowWin === highWin`.

### i. SixSixSix

**✅ PASS — Partner rotation correct**
`useScoringState.ts:891-896`:
- Segment 0 (H1-6): [A,B] vs [C,D]
- Segment 1 (H7-12): [A,C] vs [B,D]
- Segment 2 (H13-18): [A,D] vs [B,C]
Round-robin: everyone partners with everyone exactly once ✓.

**✅ PASS — Three scoring methods implemented**
`useScoringState.ts:922-934`: low_ball, combined, match_play. Segment banner triggers after holes 6 and 12 with haptic + chime.

### j. 3-Putt Poker

**✅ PASS — Card assignment logic**
`useScoringState.ts:982-1000`:
- Chip-in → 2 cards
- One-putt → 1 card
- 3+ putts → 0 cards + `(putts - 2) * penalty` to pot
- Standard 52-card deck, shuffled once at game start

**✅ PASS — Poker hand evaluation**
`poker.service.ts` — Full hand ranking: Royal Flush (10), Straight Flush (9), Four of a Kind (8), Full House (7), Flush (6), Straight (5) with Ace-low wheel support, Three of a Kind (4), Two Pair (3), Pair (2), High Card (1).

**🟡 WARNING — Only 3 cinematic moments, not 4**
`useScoringState.ts:1015-1020` — Moments fire for ROYAL_FLUSH, STRAIGHT_FLUSH, FOUR_OF_KIND only. Spec calls for 4 cinematic moments. The 4th (WORST_PUTTER tracking) is not a DormieMoment — it's a tracking field with no cinematic trigger.

**⚪ NOTE — No settlement display for 3-Putt Poker**
Pot tracking and card dealing work, but PostRoundSummary has no poker payout section. Pot winner determination is not surfaced to the user.

---

## 3. SIDE GAMES

### Files Audited
- `src/scoring/calculations.ts` — Result builders for 7 side games
- `src/components/SideGameToast.tsx` — Event detection (~234 lines)
- `src/components/scoring/PostRoundSummary.tsx` — Settlement UI

### Fully Implemented (Calculation + Detection + Settlement UI)

| Game | Calc Function | Detection | Settlement | Status |
|------|--------------|-----------|------------|--------|
| Skins | `buildSkinsResult` | Auto | $2/skin | ✅ PASS |
| Nassau | `buildNassauResult` | N/A | $5/segment | ✅ PASS |
| Wolf | `buildWolfResult` | UI-driven | $1/point | ✅ PASS |
| BBB | `buildBBBResult` | Auto+Semi | $1/point | ✅ PASS |
| Dots | `buildDotsResult` | Auto | $1/dot diff | ✅ PASS |
| Snake | `buildSnakeResult` | Auto (3-putts) | $5 penalty | ✅ PASS |
| Greenies | `buildGreeniesResult` | Semi-Auto | Generic | ✅ PASS |

### Partially Implemented (Detection Only)

| Game | Detection | Calculation | Settlement | Status |
|------|-----------|-------------|------------|--------|
| Sandies | Semi-Auto toast | Missing | Missing | 🟡 WARNING |
| Barkies | Semi-Auto toast | Missing | Missing | 🟡 WARNING |
| Arnies | Semi-Auto toast | Missing | Missing | 🟡 WARNING |
| KP/Proxies | Manual input modal | Missing | Missing | 🟡 WARNING |
| Poleys | Manual input modal | Missing | Missing | 🟡 WARNING |
| 3-Putt Poker | Auto tracking | Partial (hands) | Missing | 🟡 WARNING |

### Not Implemented

| Game | Status |
|------|--------|
| Hammer | State stub only (`useScoringState.ts:170-174`), no detection/calc/settlement |
| Trash | Type defined, not in display list |
| Hogans | Type defined, not in display list |
| Murphys | Type defined, not in display list |

**🟡 WARNING — Generic fallback for unimplemented side games**
`calculations.ts:266` — `buildGenericResult()` returns `"Results tracked -- detailed scoring coming soon"`. Any unimplemented game shows this placeholder. Not flagged to the user as incomplete.

**⚪ NOTE — Side game results not persisted to Supabase**
All side game results are calculated client-side and displayed in PostRoundSummary. Only `wolf_data` and `bbb_data` are stored on the round record (useScoringState.ts:709-730). No dedicated side_game_results table.

---

## 4. SEASON INTEGRATION

### Files Audited
- `src/services/scoring.service.ts` — `processSeasonRound()` (lines 46-137)
- `src/data/seasons-detail.ts` — FedEx Cup computation
- `src/scoring/useScoringState.ts` — Post-round season write (lines 732-746)

### Findings

**🔴 CRITICAL — Offline sync writes gross score instead of Stableford points**
`roundStorage.ts:232-239` — When an offline round syncs to Supabase, the season_scores write uses `points: round.grossScore` (raw score, e.g., 85) instead of calculated Stableford points (e.g., 12). Online rounds correctly call `processSeasonRound` which calculates Stableford. This means offline rounds have massively inflated season point values, corrupting standings.

**🟡 WARNING — Season Stableford uses gross-only calculation**
`scoring.service.ts:15-32` — `calculateStablefordFromRound(holeScores, coursePars)` does not accept a `handicapStrokes` parameter. The per-hole function `calculateStablefordPoints` (scoring.ts:124) DOES accept handicapStrokes, but it's unused in the season path. If a season uses "Net Stableford", all points will be calculated as gross Stableford.

**✅ PASS — Multi-round week handling**
`scoring.service.ts:108-130` — Correctly fetches all scores for user in that week, loads season config for `multi_round_week`, `rounds_allowed_per_week`, `best_rounds_count`, and updates `is_counting` flags.

**✅ PASS — Participation bonus**
`scoring.service.ts:101-106` — Awards participation points if configured and player logged >= 1 round.

**✅ PASS — FedEx Cup standings computation**
`seasons-detail.ts:249-256` — Points table `[25, 20, 16, 12, 10, 8, 6, 4, 2, 1]` for positions 1-10. Week multipliers: 2.0 for majors, 1.5 for playoffs, 1.0 regular. Drop worst week if played 3+ weeks.

---

## 5. OFFLINE BEHAVIOR

### Files Audited
- `src/lib/networkStatus.ts` — Network detection
- `src/lib/roundStorage.ts` — Round persistence + offline queue + sync
- `src/lib/offline.ts` — Caching layer
- `app/(tabs)/index.tsx` — Sync registration

### Findings

**✅ PASS — Offline detection**
`networkStatus.ts` — Uses `@react-native-community/netinfo` with graceful fallback (assumes online if not installed). `useNetworkStatus()` hook returns `{ isConnected, isInternetReachable }`.

**✅ PASS — Active round persistence**
`roundStorage.ts:15-111` — Saves to `dormie_active_round` AsyncStorage key after every hole. Complete Map serialization/deserialization with type-safe conversion. Crash recovery via `getActiveRound()`.

**✅ PASS — Auto-sync on reconnect**
`roundStorage.ts:261-281` — `registerOfflineSync()` subscribes to connectivity changes. Called in Home screen useEffect (index.tsx:1075). Also calls `syncOfflineRounds()` immediately on mount for app restart recovery.

**🔴 CRITICAL — Offline queue stores empty holeScores** (duplicate of Engine Core finding)
`useScoringState.ts:769` — See Section 1. Offline rounds sync with zero hole detail.

**🔴 CRITICAL — Offline season sync writes wrong points** (duplicate of Season finding)
`roundStorage.ts:232-239` — See Section 4. Gross score used instead of Stableford.

**🟡 WARNING — No error logging on sync failures**
`roundStorage.ts:244-246` — `catch { failed++ }` with no logging. Failed rounds stay queued indefinitely. Makes debugging offline issues very difficult.

**⚪ NOTE — No exponential backoff on sync retry**
Sync fires on every connectivity change. If a round consistently fails (e.g., RLS violation), it will attempt on every network transition without backoff.

---

## 6. LEDGER/WAGER INTEGRATION

### Files Audited
- `src/services/ledger.service.ts` — Ledger CRUD + auto-settle methods
- `src/components/scoring/PostRoundSummary.tsx` — Settlement UI
- `supabase/migrations/20260411_ledger.sql` — Schema
- `app/ledger.tsx` — Ledger screen

### Findings

**🔴 CRITICAL — Auto-settle methods defined but never called**
`ledger.service.ts:291-317` — `autoSettleNassau()` and `autoSettleSkins()` are fully implemented but:
- Not imported in `useScoringState.ts`
- Not imported in `PostRoundSummary.tsx`
- Not called anywhere in the round completion flow

Expected flow after round completion:
```
roundsService.create() → processSeasonRound() → ledgerService.autoSettle*()
                                                  ↑ THIS STEP IS MISSING
```

This was the P0 April 12 feature. The backend methods exist, the schema is complete, but the wiring is absent.

**🔴 CRITICAL — Settlement button shows placeholder alert**
`PostRoundSummary.tsx:618` — "Settle Up" button shows `Alert.alert("Venmo / Cash settlement will be tracked here in production.")` instead of creating ledger entries. Settlement calculation logic (lines 435-586) works correctly — it computes accurate payouts for Nassau ($5/segment), Skins ($2/skin), Dots ($1/dot), Snake ($5), Wolf ($1/pt), BBB ($1/pt) — but nothing is persisted.

**✅ PASS — Database schema complete**
`20260411_ledger.sql` — `wagers`, `ledger_entries`, `settlements` tables with RLS policies. Schema is ready for integration.

**✅ PASS — Ledger screen read/display**
`app/ledger.tsx` — Correctly displays entries via `ledgerService.getEntriesForUser()`, shows simplified debts, allows manual settlement recording.

**✅ PASS — Settlement calculation logic correct**
`PostRoundSummary.tsx:435-586` — Accurate payout calculations for all 7 fully implemented side games. Greedy debt simplification algorithm produces correct "who owes whom" results.

---

## SUMMARY

| Area | 🔴 Critical | 🟡 Warning | ⚪ Note | ✅ Pass |
|------|------------|-----------|--------|--------|
| Engine Core | 2 | 4 | 2 | 4 |
| Scoring Formats | 0 | 1 | 1 | 16 |
| Side Games | 0 | 7 | 1 | 7 |
| Season Integration | 1 | 1 | 0 | 3 |
| Offline Behavior | 2 | 1 | 1 | 3 |
| Ledger/Wager | 2 | 0 | 0 | 3 |
| **Total** | **7** | **14** | **5** | **36** |

Note: 2 critical findings appear in multiple sections (offline holeScores and offline season points).

---

## TOP 5 PRIORITIES

### 1. Wire ledger auto-settlement into round completion flow
**Severity:** 🔴 CRITICAL — P0 feature from April 12 not integrated
**Files:** `useScoringState.ts` (add import + call after line 762), `PostRoundSummary.tsx` (replace placeholder alert at line 618)
**Impact:** Nassau and Skins settlements never persist. Users see correct amounts but "Settle Up" does nothing.

### 2. Fix offline round holeScores serialization
**Severity:** 🔴 CRITICAL — Data loss on offline rounds
**File:** `useScoringState.ts:769`
**Fix:** Replace `holeScores: [] as any[]` with the actual `holeScores` array from line 673-677.
**Impact:** Offline rounds sync with no hole detail, breaking handicaps, stats, and season processing.

### 3. Fix offline season sync to calculate Stableford points
**Severity:** 🔴 CRITICAL — Corrupts season standings
**File:** `roundStorage.ts:232-239`
**Fix:** Calculate Stableford points from hole scores before writing to season_scores, instead of using raw `grossScore`.
**Impact:** Any round scored offline inflates season standings by 5-10x (e.g., 85 points instead of ~12).

### 4. Fix seasonWeekId / seasonId duplication
**Severity:** 🔴 CRITICAL — Season config lookup may fail
**File:** `useScoringState.ts:739-740`
**Fix:** Ensure `seasonId` resolves to the parent season, not the week ID.
**Impact:** Multi-round week calculations may use wrong config or fail silently (due to empty catch at line 744).

### 5. Add error handling for season processing failures
**Severity:** 🟡 WARNING — Silent data loss
**File:** `useScoringState.ts:744`
**Fix:** Replace `catch {}` with error logging + toast notification to user.
**Impact:** Season scoring can fail with zero user feedback, leading to missing standings data.
