# Match-status consolidation plan — Phase 2 of docs/matchplay-architecture.md

**Status:** Investigation complete (2026-07-08, read-only — no code changed). This document is the execution plan for consolidating the four parallel match-status implementations onto `formatMatchState`. Written for a cold session to execute stage-by-stage.

**Why now:** the architecture doc sequenced this LAST, against a proven engine. The engine is now proven: 1v1 singles (Stages 1–3b) + 2v2 team (Stages 4a–4c) shipped on `formatMatchState` + the Layer A derives + `resolveMatchResult`/`resolveTeamMatchResult` (clinch freeze), with 30+ engine tests (MPF, RMR, TMR, TMS blocks in `src/data/__tests__/scoring-formats.test.ts`).

**The target engine (what everything migrates onto):**
- `formatMatchState(holesWonA, holesWonB, holesPlayed, totalHoles, perspective?)` — `src/data/scoring.ts:846`. Layer B: status/lead/leader/isComplete + `currentDisplay` (live, keeps recomputing) + `finalDisplay` (naive final form — drifts if fed post-clinch totals, BY DESIGN; see below).
- `resolveMatchResult` / `resolveTeamMatchResult` — `src/scoring/matchplay-result.ts`. Walk-ordered clinch FREEZE for post-match display (the drift-proof form). Shared `walkMatchResult` core with Layer A injected.
- Layer A derives — `deriveSinglesSideScore`, `deriveBestBallSideScore`, `deriveAggregateSideScore` in `src/data/scoring.ts`.

**Canonical display notation (what the engine emits):** `"2 UP thru 9"`, `"AS thru 12"`, `"DORMIE"`, `"3 DOWN thru 5"` (perspective), final `"3&2"` (no spaces), `"1 UP"`, `"HALVED"`.

---

## Implementation #1 — `calculateMatchPlay` / `calculateNetMatchPlay`

`src/data/scoring.ts:712` and `:786` (net wrapper subtracts per-hole strokes, delegates).

### A. What it computes
- **Inputs:** two positional raw-score arrays (index = hole order); net wrapper adds optional per-player stroke arrays.
- **Output:** `MatchPlayResult { holesWonA, holesWonB, holesHalved, holeResults[], result, winner, matchEndedAtHole }`.
- **Semantics:** hole-by-hole walk **with `break` at clinch** (`lead > holesRemaining`) — `matchEndedAtHole` freezes at the close-out hole and later array entries are never read. **No drift.** This is the same freeze semantics `resolveMatchResult` later re-implemented for the live path.
- Result strings: `"N&M"` (early), `"N UP"` (final hole), `"HALVED"`. No DORMIE, no "thru N", no perspective/DOWN, no in-progress concept (assumes a complete board).
- Dead branch: `result = matchEndedAtHole === totalHoles ? 'HALVED' : 'AS'` — the `'AS'` arm is unreachable (a level match can never clinch early, so `matchEndedAtHole` is always `totalHoles` when `finalDiff === 0`).

### B. Who consumes it
- **Tests only.** `scoring-formats.test.ts` blocks 7.x (10 tests) and 7W.x (5 tests). Zero live call sites in `app/` or `src/` outside `data/scoring.ts` itself.
- `MatchPlayResult` type: internal to `data/scoring.ts` + tests. Safe to delete with the functions.
- One aspirational comment (`data/scoring.ts` fourball section, ~line 979/1056) recommends composing fourball match via `calculateNetMatchPlay` — that recommendation is now obsolete (Stage 4 wired fourball-shaped team match via `deriveBestBallSideScore` + `formatMatchState` instead). Update the comment during migration.

### C. Behavioral diffs vs formatMatchState
- Notation identical for final forms (`"3&2"`, `"1 UP"`, `"HALVED"`).
- `holeResults[]` truncated at clinch (break) — `formatMatchState` has no per-hole output at all; `resolveMatchResult` has no per-hole output either. If the ported tests assert `holeResults`, that assertion has no direct successor (assert via `clinchHole` instead).
- `matchEndedAtHole` ≈ `resolveMatchResult`'s `clinchHole` (diff: `matchEndedAtHole` = totalHoles when no early close; `clinchHole` = null).
- No behavioral bug. It is simply a third copy of the walk-freeze that `resolveMatchResult` now owns.

### D. Migration shape
**Delete, don't adapt.** `resolveMatchResult` supersedes it (same walk-freeze, richer output, live-path-proven). Port the 15 tests' *semantics* to `resolveMatchResult`/`formatMatchState` equivalents where not already covered (most RMR/TMR tests already cover the same ground — audit for the handful of unique cases: single-hole match 7.x, identical-arrays HALVED, net-flips cases in 7W.x). Then delete `calculateMatchPlay`, `calculateNetMatchPlay`, `MatchPlayResult`, and the dead-`'AS'` quirk with them.

---

## Implementation #2 — `evaluateMatch` (4-team Ryder)

`src/services/fourTeamRyder.service.ts:108`.

### A. What it computes
- **Inputs:** pre-resolved hole winners `Record<number, { winner: 'team1'|'team2'|'halved' }>` + totalHoles. (Layer A — how a winner was decided — happens upstream in the UI.)
- **Output:** `{ team1Holes, team2Holes, holesPlayed, matchWinner, status: 'pending'|'in_progress'|'complete', margin }`.
- **Semantics:** totals-based (no walk-break; iterates sorted keys but only counts). Branch order: clinch check FIRST (`lead > holesRemaining && holesRemaining >= 0 && played > 0`), then `played === 0` → pending, then `played >= totalHoles` → FINAL, else in-progress. No net, no perspective, no DORMIE, no "thru N" (consumers show `holesPlayed/totalHoles` separately). Multi-team semantics live in `pointsForMatch` / `computeStandings` / cup-clinch — NOT in `evaluateMatch`, which is strictly one A-vs-B match.

### B. Who consumes it
- `FourTeamRyderHub.handleHoleUpdate` (`src/components/seasons/FourTeamRyderHub.tsx:48`) — persists status/matchWinner/points on each hole entry; fires the MATCH_CLOSED cinematic with `evalRes.margin` as detail.
- `FourTeamRyderMatch` card (`:32`) — renders `margin` in the card center.
- **⚠️ THE ENTIRE PATH IS ORPHANED.** `FourTeamRyderHub` is imported by NOTHING — not `app/`, not `season-detail.tsx` (which handles `season_type === 'ryder'` only), nowhere. Meanwhile `season-create.tsx` OFFERS `four_team_ryder` as a selectable season type. Users can create a 4-team Ryder season whose hub never renders. No tests reference `fourTeamRyder` either. This is a reality-map-grade gap independent of consolidation (flagged in compost).

### C. Behavioral diffs vs formatMatchState — including two latent bugs
1. **"N&0" full-distance bug (latent, would be user-visible the day the hub mounts):** the clinch branch fires when `holesRemaining === 0` and `lead > 0` — so EVERY wire-to-wire win margins as `"1&0"`/`"2&0"` instead of `"1 UP"`/`"2 UP"`. The `played >= totalHoles` branch is unreachable for `lead > 0`. The margin feeds both the match card AND the MATCH_CLOSED cinematic detail. `formatMatchState`/`resolveMatchResult` handle this correctly (`remaining > 0` guard) — **migration is the fix.**
2. **Halved margin reads `'AS'`** where the engine canon is `'HALVED'` for a completed level match (status label separately shows HALVED, so the card shows "HALVED" pill + "AS" margin — inconsistent).
3. Drift-shaped (totals-based) but drift is unreachable: `FourTeamRyderMatch` hides quick-entry once `status === 'complete'`. Fragile-by-gating, same pattern as #3.
4. `margin: ''` for pending — `formatMatchState` has no pending concept (caller checks `holesPlayed === 0`).

### D. Migration shape
Thin adapter inside the service, public API unchanged:
map team1/team2 → A/B hole counts, call `formatMatchState(t1, t2, played, totalHoles)`, map back (`status`: played===0 → pending / `isComplete` → complete / else in_progress; `margin`: complete → `finalDisplay`, in-progress → `currentDisplay` sans "thru" or keep current "N UP"/"AS" form). Round-robin scheduling, points conversion, standings, cup-clinch stay in the service untouched — `formatMatchState` genuinely can't and shouldn't express them; they are not match-status.
**Open product decision first:** mount the hub, or park the whole feature? If parked, consolidation of a dead path is optional — do it anyway (it's ~30 minutes with tests and kills a latent bug), or delete the family. Don't leave it as-is: `four_team_ryder` being selectable in season-create with no rendering path is the worse bug.

---

## Implementation #3 — `computeMatchStatus` + `formatMatchStatusDisplay` (RyderCupHub)

`src/components/RyderCupHub.tsx:227` and `:266`. Module-private functions.

### A. What it computes
- **Inputs:** `Record<number, HoleResult { redScore, blueScore, winner }>` + totalHoles. Upstream Layer A: `getEffectiveScores` (`:1202`) — fourball = min of the two players' scores, **missing scores default to PAR**; foursomes/singles/scramble = single team entry, also defaulting to par. Gross only — zero handicap anywhere on the RC path.
- **Output:** `{ status: MatchStatus, leader: 'red'|'blue'|null, lead, holesPlayed, finalResult, winner }` where `MatchStatus` is the union `'AS'|'1 UP'|...|'5 UP'|'DORMIE'|'HALVED'|'FINAL'` — note `\`${lead} UP\` as MatchStatus` at `:261` casts a 6+-up lead outside the union (type lie, works at runtime).
- **Semantics:** totals-based. Branch order: all-played (HALVED or FINAL `"N UP"`) → clinch (`"N & M"` **with spaces**) → DORMIE (correct condition incl. `lead > 0`, `holesPlayed > 0`) → AS → `"N UP"` in-progress. Richest of the four, as the architecture doc said.
- Display layer: `formatMatchStatusDisplay` → `"ALL SQUARE thru 9"`, `"DORMIE (Red leads)"`, `"2 UP thru 5"`, or `finalResult` verbatim.

### B. Who consumes it
- `RCMatchScoring` (same file): live status banner (`statusDisplay`, `:1319`), header mini-score (leader/lead, `:1341–1349`), completion effect (`:1225–1233`) — first time `matchStatus.winner` is set, `matchFinished` flips and `onMatchComplete(match.id, winner, resultStr)` persists the result string to the match list. Hole strip and running-score sections read `holeResults` directly.
- **LIVE USER PATH:** `RyderCupHub` is lazy-mounted from `app/trip-detail.tsx:2653`. This is the shipped 2-team Ryder Cup feature — the working live team match play in production.

### C. Behavioral diffs vs formatMatchState
| Case | RyderCupHub today | formatMatchState | Visible? |
|---|---|---|---|
| Clinch final | `"3 & 2"` (spaces) | `"3&2"` | Yes — banner + persisted result string |
| All-square live | `"ALL SQUARE thru 9"` | `"AS thru 9"` | Yes — banner |
| Dormie live | `"DORMIE (Red leads)"` | `"DORMIE"` | Yes — banner (RC form is richer) |
| In-progress | `"2 UP thru 5"` | `"2 UP thru 5"` | Identical |
| Full-distance win | `"N UP"` | `"N UP"` | Identical |
| Perspective | none (red/blue coloring instead) | A/B DOWN-forms | RC doesn't want DOWN — leader coloring is its perspective |
- **Clinch/drift:** totals-based and drift-SHAPED, but unreachable: Lock Hole hides once `matchFinished` (`:1479`), locked holes can't re-lock, and the persisted result string was captured at clinch time by the completion effect. **Correct today, fragile by construction** — the freeze lives in UI gating + a boolean flag, not in engine semantics. Any future "edit a locked hole" or "keep playing for fun" feature silently reintroduces drift into the banner AND (worse) would not re-fire `onMatchComplete` (guarded by `matchFinished`), leaving persisted vs displayed results diverging.
- Missing-score-defaults-to-par is a Layer A semantics difference vs the regular path's null-contract derives — migrating Layer A (getEffectiveScores → derive variants) would CHANGE behavior for partially-entered holes (today: par-filled and lockable; derives: null → hole not lockable). That is a bigger behavioral change than the Layer B swap — split it out.

### D. Migration shape
Two independent swaps — do NOT couple them:
1. **Layer B (this plan's scope):** replace `computeMatchStatus` internals with `formatMatchState` on red→A/blue→B counts; keep a thin RC formatter that maps structured fields (`status`, `lead`, `leader`, `isComplete`) to the EXACT current strings (`"ALL SQUARE thru N"`, `"DORMIE (Red leads)"`, `"N & M"`) so device output is byte-identical. Optionally migrate the completion path to a `resolveMatchResult`-style walk over `holeResults` to make the freeze engine-owned instead of flag-owned.
2. **Layer A (defer / separate stage):** `getEffectiveScores` → `deriveBestBallSideScore`/`deriveSingleEntrySideScore`. Changes par-default semantics; product decision needed on partial-hole behavior. Also `deriveSingleEntrySideScore` does not exist yet (Stage 4 shipped without alt-shot single-entry — the regular path has no team-entry UI). Not required for Layer B consolidation.
- Ryder red/blue stays a UI skin (per the architecture doc's "don't introduce red/blue at the engine level").

---

## Implementation #4 — Matchup-tab inline computation (ScoringModals)

`src/components/scoring/ScoringModals.tsx`, inside `LiveLeaderboard`'s matchup view (the IIFE — currently ~`:697+`, was `:492–533` pre-Stage-3/4 edits).

### A. What it computes
- **Inputs:** `allScores` + `matchupOpponent` (URL param via season-week/league launch) + `holes`. Player 'you' is hardcoded id `'1'`.
- **Semantics:** per-hole gross-vs-gross where BOTH scores exist (`myScore && oppScore` — pairwise-complete, same convention as the engine callers); running `myUp` counter; status string `"ALL SQUARE thru N"` / `"X UP thru N"` / `"X DOWN thru N"`. Plus a per-hole result grid (win/loss/halve/pending) that is display-only.
- No net, no dormie, no clinch, no final concept — it keeps counting to 18 regardless. It is a running comparison view, not a match adjudicator.

### B. Who consumes it
- Only the matchup competition tab inside the LiveLeaderboard modal, rendered when `activeCompTab === 'matchup' && matchupOpponent`. Live path when a round is launched with `matchupOpponent` (season-week matchups). Small blast radius: one tab, one modal, display-only, no persistence.

### C. Behavioral diffs vs formatMatchState
- `"ALL SQUARE thru N"` vs engine `"AS thru N"` — visible wording change if the engine string is used raw.
- DOWN-form: identical (`"2 DOWN thru 12"`) — this tab is the reason `formatMatchState` grew perspective.
- DORMIE: would APPEAR where today it shows a plain `"X UP thru N"` — a behavior IMPROVEMENT, but a visible change to flag in device verification.
- Post-clinch: today keeps showing running status (e.g. `"5 UP thru 16"` on a mathematically-over match); `currentDisplay` does the same EXCEPT it emits DORMIE at the dormie point. No drift bug because no final display exists.
- Per-hole grid: no engine equivalent — stays as-is (it consumes raw scores, not status).

### D. Migration shape
Smallest of the four: inside the existing IIFE, count `holesWonA/holesWonB/holesPlayed` in the loop that already builds `holeResults`, call `formatMatchState(won, lost, played, holes.length, 'A')`, render `currentDisplay` (uppercase-adapting "AS thru" → "ALL SQUARE thru" if we keep current wording — recommend keeping engine wording for consistency with the match-play banner users now see everywhere else). The per-hole grid loop stays. Alternatively (architecture doc's Phase 2 shape): feed a `{ format:'singles', sideA:['1'], sideB:[matchupOpponent] }` config through the same plumbing as `matchPlayState` — heavier, not needed for consolidation; the inline formatMatchState call achieves the goal.

---

## E. Risk ranking (safest → scariest)

1. **#1 `calculateMatchPlay`/`calculateNetMatchPlay`** — tests-only, zero user surface, superseded engine. Pure port-and-delete.
2. **#2 `evaluateMatch`** — the entire consuming feature is unmounted (orphaned); migrating it cannot affect any user. Bonus: kills the latent "N&0" bug. Only risk is wasted effort if the 4-team family gets deleted instead of mounted — hence the product decision gate.
3. **#4 Matchup tab** — live but tiny: one display-only tab, no persistence, no side effects. The only visible deltas are wording ("ALL SQUARE"→"AS") and DORMIE appearing.
4. **#3 RyderCupHub** — the shipped, live, users-rely-on-it feature; persistence side effects (`onMatchComplete` → match list, moments); the freeze is UI-flag-based and must not regress; display strings are user-familiar. Scariest, exactly as the architecture doc predicted.

**Correction to the prior:** "Matchup tab safest" was right *among live paths* — but #1 and #2 turn out to be entirely dead paths (tests-only / unmounted), making them strictly safer than anything user-visible. RyderCupHub scariest: confirmed.

## F. Sequencing plan

Execute in risk order. Each stage: characterization tests FIRST, swap, gates (tsc 23 baseline, scoring suite, poker 39), commit, device verification per batch rules.

- **Stage C1 — #1 (engine dedup).**
  Before: audit 7.x/7W.x tests for cases not already covered by RMR/TMR (single-hole match, net-flip variants, all-halved); port those to `resolveMatchResult`/`formatMatchState` equivalents (assert `clinchHole` instead of `matchEndedAtHole`/`holeResults`).
  Swap: delete `calculateMatchPlay`, `calculateNetMatchPlay`, `MatchPlayResult`, the 7.x/7W.x blocks; update the obsolete fourball-composition comment.
  Device: none (no surface). Expected scoring count DROPS (~-15) — document in the commit so the gate baseline is explicit.
- **Stage C2 — #4 (Matchup tab).**
  Before: characterization is cheap — the status string is derivable; add 2–3 tests asserting `formatMatchState(...,'A').currentDisplay` for the boards the tab shows (UP/DOWN/AS), pinning the adapter choice (engine wording vs "ALL SQUARE").
  Swap: inline `formatMatchState` call per §4D. Matchup tab ONLY; the round tab and Stage-3 Stableford branch untouched.
  Device (two-sided): launch a season-week matchup round → matchup tab statuses match hole-by-hole entry incl. DOWN + dormie board; non-matchup rounds unaffected.
- **Stage C3 — #2 (evaluateMatch)** — GATED on the product decision: mount 4-team Ryder or park it (compost decision item).
  Before: characterization tests for `evaluateMatch` current behavior, with the "N&0" and 'AS'-margin cases explicitly documented as WRONG (expected values written against the POST-migration canon, current behavior noted in comments).
  Swap: adapter per §2D, service API unchanged. Points/standings/cup-clinch tests (new — none exist) pin the untouched layers.
  Device: impossible until the hub mounts; if it mounts, full 4-team flow incl. a wire-to-wire 1 UP finish (the fixed case).
- **Stage C4 — #3 (RyderCupHub Layer B).**
  Before: export `computeMatchStatus` for test (or extract to a service file); characterization tests pinning ALL current strings incl. `"3 & 2"` spacing, `"ALL SQUARE thru N"`, `"DORMIE (Red leads)"`, and the completion-string capture; decide explicitly whether the persisted result string keeps `"3 & 2"` or migrates to `"3&2"` (recommend: keep RC strings byte-identical via the thin formatter — zero user-visible change).
  Swap: `computeMatchStatus` internals → `formatMatchState` + RC formatter; keep `matchFinished` flag semantics EXACTLY (do not "improve" the freeze in the same commit — if making the freeze engine-owned via a walk, do it as a separate follow-up commit with its own tests).
  Device (the heavyweight): full RC flow — live banner through UP/AS/DORMIE/clinch, mini-score, completion → match list result string, MATCH_CLOSED moment, and a full-distance finish. Two-sided: regular-path match play (singles + 2v2) unaffected.
  Layer A (getEffectiveScores → derives) is explicitly OUT of C4 — separate future stage with its own product decision on par-defaulting.

## G. What dies

| Artifact | LOC (approx) | Fate |
|---|---|---|
| `calculateMatchPlay` + `calculateNetMatchPlay` + `MatchPlayResult` | ~85 | Deleted (C1) |
| 7.x/7W.x test blocks | ~180 | Deleted; unique cases ported (~40 added back) |
| Matchup-tab inline status math | ~10 of ~20 (grid loop stays) | Replaced by 1 engine call (C2) |
| `evaluateMatch` internals | ~45 → ~15 adapter | Shrunk (C3) |
| `computeMatchStatus` internals | ~37 → ~12 adapter + formatter | Shrunk (C4); `formatMatchStatusDisplay` stays as the RC skin |
| `MatchStatus` union type-lie (`as MatchStatus`) | — | Dies with C4 (structured fields replace string-status) |

Net: roughly **−200 LOC** and, more importantly, ONE place where clinch/dormie/halved logic can be wrong instead of four. After C1–C4 the only match-status math outside `formatMatchState`/`walkMatchResult` is hole-winner derivation (Layer A), which is the intended architecture.

## H. The clinch question

**No user-hittable finalDisplay-drift bug exists today** — but two of the four are drift-shaped and protected only by UI gating:

- **#1:** immune (walk-break freeze — it had the right idea first).
- **#2 `evaluateMatch`:** drift-shaped (totals-based). Unreachable: entry UI hides at `complete`, and the whole feature is unmounted anyway. The REAL latent defects are the **"N&0" full-distance margin** and **'AS' halved-margin** — cosmetic-but-wrong golf notation that ships the moment 4-team Ryder mounts, in both the match card and the MATCH_CLOSED cinematic. Severity: low today (dead path), medium the day it mounts, trivial to fix (the migration fixes it for free).
- **#3 `computeMatchStatus`:** drift-shaped. Unreachable today: Lock Hole hidden after `matchFinished`, no hole-editing exists, completion string captured once at clinch. **Severity: none today, HIGH fragility** — an edit-locked-hole or play-on feature would silently desync banner from persisted result. The consolidation should leave a comment (or engine-owned freeze, as the C4 follow-up) marking this invariant.
- **#4 Matchup tab:** no final display exists, so no drift by definition; it shows running status past mathematical decision (arguably a feature for a comparison view). DORMIE-awareness arrives free with C2.

## Compost hand-offs (log these when this plan executes — or now)

1. **4-team Ryder is orphaned:** `season-create` offers `four_team_ryder`; `FourTeamRyderHub` is mounted nowhere; `season-detail` renders only `'ryder'`. Product decision: mount, hide the wizard option, or delete the family. Gates Stage C3.
2. **RC Layer A par-defaulting:** `getEffectiveScores` fills missing scores with par — divergent from the regular path's null contract. Own decision + stage, after C4.
3. **`deriveSingleEntrySideScore` does not exist** — alt-shot/scramble single-entry (architecture doc Artifact 2) was never needed by Stage 4 and remains unbuilt; required for RC Layer A migration.
