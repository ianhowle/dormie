# Input-layer rework — execution plan (Phase 1 investigation)

**Status:** Investigation complete (2026-07-08, read-only — no code changed). Execution plan for the rework spec'd in `docs/rework-scoring-input-layer.md` (`ff916ff`/`92afd26`), structured for a cold session to execute stage-by-stage.

**Context chain:** freeze fixes `66f5dd3` (SideGameToast queue + suspended gate + detection serialization) and `7ccf36e` (DormieMoment × PuttDist gate — the SECOND bite that raised the coordinator's priority); putt-capture regressions logged 2026-06-09; the Option C / Tier-3 coordinator sketch in compost.

---

# PART 1 — THE MODAL CENSUS

**13 native-`<Modal>` surfaces reachable from the scoring screen** — five more than the spec's "8 modals" (the spec predates MatchPlaySetupModal and never counted DormieMoment, LiveLeaderboard, the 6-6-6 transition, or BangoPrompt as census members). Non-modal overlays (HoleTransitionBanner, the format banners, SideGameToast's non-manual toast) are animated Views — no native-modal collision exposure — and are excluded.

| # | Surface | Trigger (A) | Visibility state (B) | Reset by |
|---|---|---|---|---|
| 1 | `PuttDistModal` | **AUTO in `handleNext`** — fires when ANY player has `putts > 0`. Default putts is **2** (`useScoringState.ts:446`) → fires for every player, every hole (the 2026-06-09 regression, confirmed at code level). Sequential per player via `playerIdx`. | `puttDistPrompt.show` — set in `handleNext:747`; render-gated `&& !s.dormieMoment.visible` (`7ccf36e`) | `handlePuttDistSelect` after last player (also advances hole + fires deferred detection) |
| 2 | `ManualInputModal` (inside SideGameToast) | **AUTO promotion effect** — queued manual events (sandies/bark/poleys/close_shave/bango-manual) promote when `!manualEvent && !suspended` | `manualEvent !== null && !suspended` | onConfirm/onDismiss filter the queue |
| 3 | `WolfModal` | **AUTO effect on hole-change** (`useScoringState.ts:497`) + mount effect (`:509`) when wolf active and hole undecided | `showWolfModal` | onClose / onDecision |
| 4 | `BBBPrompt` (Bango) | **AUTO in `handleNext`** — `setShowBangoPrompt(true)` on EVERY scored BBB hole (`:664`, unconditional within the BBB block) | `showBangoPrompt` | onSelect / onSkip |
| 5 | `HammerModal` | User tap (hammer button, `app/scoring.tsx:430`) | `showHammerModal` | onAccept / onFold |
| 6 | `DormieMoment` | **AUTO, five writers:** `checkDormieMoments` in `handleNext:604` (dormie/match-closed — now `isMatchPlay`-gated `7fc727e` — and skins jackpot); BBB triple crown (`:653`, same commit as Bango open); Wolf lone/blind victory (`:688`); Low/High CLEAN_SWEEP (`:715`); 3-putt-poker hands (useEffect `:1320`); plus BBBPrompt's onTripleCrown callback | `dormieMoment.visible` (conditionally rendered, lazy) | onDismiss |
| 7 | `SixSixSixSegmentTransition` | **AUTO in `handleNext`** at holes 6/12 on 6-6-6 rounds (`:731`); self-dismisses after 4s | `sixSegmentBanner.visible` | onDismiss / 4s timer |
| 8 | `MatchPlaySetupModal` | Mount — `useState(isMatchPlay)` | `showMatchPlaySetup && isMatchPlay` | Start Match |
| 9 | `BestBallSetupModal` | Mount — `useState(isBestBall)` | `showBestBallSetup && isBestBall` | Start Round |
| 10 | `LowHighSetupModal` | Mount | `showLowHighSetup && isLowHigh` | Start |
| 11 | `SixSixSixSetupModal` | Mount | `showSixSetup && isSixSixSix` | Start |
| 12 | `HoleNotesModal` | User tap (note tool, `:342`) | `showNoteModal` | Cancel / Save |
| 13 | `LiveLeaderboard` | User tap (leaderboard button) | `showLeaderboard` | onClose |

Also found: **`WagerSetup` contains a `<Modal>` and is mounted NOWHERE** — dead code, delete-list candidate.

## C. The collision matrix

**Gates that exist today (2):**
1. The `suspended` OR-clause (`app/scoring.tsx:703–719`) — gates **#2 ManualInputModal** against: PuttDist, Wolf, Hammer, Bango, all four setup modals, Notes, DormieMoment. (10 pairs covered.)
2. `PuttDistModal.visible && !dormieMoment.visible` (`7ccf36e`) — gates **#1 × #6**.

**Provably impossible pairs:** the four setup modals are mutually exclusive (format-label detection can't match two formats); setup modals block touch input while open, so user-tap surfaces (Hammer, Notes, Leaderboard) can't open behind any presented modal; user-tap × user-tap likewise. Low/High CLEAN_SWEEP moments can't meet 6-6-6 surfaces (exclusive formats).

**UNGATED AND POSSIBLE — the future freezes waiting to happen (in descending likelihood):**

| Pair | Why it can happen | Same commit? |
|---|---|---|
| **PuttDist × BangoPrompt** | `handleNext` on any scored BBB hole sets `showBangoPrompt(true)` AND `puttDistPrompt.show:true` **in the same callback**. Default putts=2 → this schedules BOTH native modals on essentially every BBB hole. Same class as both known freezes. Needs device repro to confirm how it manifests (may "work" by accidental mount order; that is not a gate). | **YES** |
| **PuttDist × SixSegmentTransition** | 6-6-6 round, holes 6/12: `handleNext` sets `sixSegmentBanner.visible` AND `puttDistPrompt.show` in the same callback. The transition self-dismisses after 4s, which may mask the race — or zombie it. | **YES** |
| **DormieMoment × BangoPrompt** | BBB triple crown writes `dormieMoment` in the SAME `handleNext` block that then sets `showBangoPrompt(true)` (`:653` → `:664`). Also: skins-jackpot moment during a BBB round. Bango has no dormie gate (only ManualInputModal does). | **YES** |
| **DormieMoment × WolfModal** | Lone-Wolf-victory moment fires in `handleNext`; hole advances in the same callback (no-putt branch) or after putt sequence; the hole-change effect then auto-opens WolfModal for the next hole **while the victory moment is still up**. The exact scenario is wolf-native: lone wolf wins → celebration + next-hole wolf pick collide. | Next commit (effect) — unguarded |
| **DormieMoment × SixSegmentTransition** | Skins-jackpot or poker moment at hole 6/12 of a 6-6-6 round: both written in the same `handleNext`. | **YES** |
| **SixSegmentTransition × BangoPrompt** | 6-6-6 + BBB active at holes 6/12. | **YES** |
| **WolfModal × BangoPrompt** | Wolf + BBB active, a hole where no player has putts>0 (chip-ins / picked-up): hole advances in `handleNext`'s else-branch → wolf effect opens over the just-opened Bango. Narrow but real. | Next commit (effect) |
| **LiveLeaderboard × ManualInputModal** | `showLeaderboard` is NOT in the suspended OR-clause — a queued manual event promotes while the leaderboard modal is open. Narrow window (promotion is fast), but ungated. | No — async |
| **PuttDist × WolfModal** | Serial **by accident of design**: the hole doesn't advance until the putt sequence completes, so the wolf hole-change effect can't fire while PuttDist is up. Safe today, fragile — anything that advances the hole earlier re-opens it. | — |

The pattern behind every ungated pair: `handleNext` is an imperative cascade that can schedule 2–3 modal-visibility writes in one commit, and each gate added so far (66f5dd3, 7ccf36e) covered exactly one pair. The matrix above is why pair-by-pair patching keeps losing.

## D. Fate under the rework

| Surface | Fate | Notes |
|---|---|---|
| PuttDistModal | **DIES** (spec step 2) — inline putt-distance pills, putts-aware | Removes the highest-frequency collider from EVERY pair it's in |
| ManualInputModal | **DIES** for sandies/bark/arnies/poleys (spec step 3); KP possibly minimal form | Kills the suspended-gate raison d'être |
| BBBPrompt (Bango) | **TRANSFORMS** — not in the spec's table (census addition). Hole-level player-pick → inline hole-level row ("Closest to pin?" quick-select), not per-player pill | Its auto-open-every-BBB-hole is the second-worst collider |
| SixSixSixSegmentTransition | **SURVIVES** as celebration/interstitial — census addition; should join the moment/celebration family and any coordinator | Auto-fire survivor |
| WolfModal | **SURVIVES** (strategic, pre-hole) | Auto-fire survivor |
| HammerModal | SURVIVES (strategic, user-tap) | Practically collision-free |
| DormieMoment | SURVIVES (celebration) | Auto-fire survivor, five writers |
| 4 setup modals | SURVIVE (once-per-round, mount-time) | Collision-free in practice |
| HoleNotesModal | SURVIVES (free text, user-tap) | Collision-free in practice |
| LiveLeaderboard | SURVIVES (full-screen overlay, user-tap) | Needs adding to whatever gate survives |
| LOG THIS HOLE global section | DIES (per-player tag pills) | Not a modal; listed for completeness |
| WagerSetup | **DELETE** — dead code, mounted nowhere | |

**Survivor count: ~10 native modals, of which THREE auto-fire (DormieMoment, WolfModal, SixSegmentTransition) plus the Bango successor's timing.** The spec's "8 → 3–4 modals" undercounted both sides.

---

# PART 2 — THE COORDINATOR QUESTION

## A. Is the coordinator moot after the rework?

**No — the compost's "becomes optional" note is wrong against the actual survivor list.** The rework kills the two highest-frequency colliders (PuttDist, ManualInputModal) — but three auto-fire surfaces survive, and they already collide TODAY in ungated pairs (DormieMoment × Wolf auto-open, DormieMoment × 666 transition — both survive the rework untouched). The spec's own hedge ("if they ever do [collide], a small useModalCoordinator covers them") is answered by the matrix: they do. What changes is the SIZE: a coordinator for 3–4 auto-fire surfaces + a handful of user-tap surfaces is a fraction of the original 13-surface problem.

## B. Sequencing recommendation: **targeted gates NOW → rework → small coordinator as the rework's last stage**

Options considered:
- **Coordinator FIRST:** stabilizes every pair including unknowns; but it must integrate with 13 surfaces including three that are about to die, the 4s-self-dismissing transition, and the toast promotion queue — significant throwaway integration work, all of it touching `handleNext` (phone-gated per stage, unbatchable). Slowest path to the rework's real value.
- **Rework FIRST (pure):** each stage deletes colliders, but for the 2–4 sessions of rework the live ungated pairs (PuttDist × Bango on every BBB round!) keep biting users.
- **RECOMMENDED — hybrid:**
  1. **Stage 0 (hours, not sessions):** extend the EXISTING gate patterns to the discovered ungated pairs — `showBangoPrompt` render gate `&& !dormieMoment.visible && !puttDistPrompt.show` (Bango can trivially wait; its state is set regardless), `sixSegmentBanner` render gate likewise, wolf auto-open effect checks `dormieMoment.visible` (defer via the same recompute pattern as `7ccf36e`), add `showLeaderboard` to the suspended OR-clause. This is pair-patching — the thing that keeps losing — but it's cheap insurance for exactly the window until the rework deletes the worst offenders, and every gate added is code the rework deletes anyway.
  2. Rework stages 1–4 (Part 4) kill PuttDist + ManualInputModal + transform Bango.
  3. **Coordinator-for-survivors as the final stage** (spec step 5 already reserves the slot): `useModalCoordinator` with `requestPresent(id)/dismiss(id)`, single in-flight id, FIFO or priority queue (celebrations yield to strategic inputs? — design decision), integrated with the 3 auto-fire survivors + Notes/Leaderboard/Hammer. All the deleted gates (suspended-clause, dormie gates, Stage-0 patches) collapse into it.

Rationale: the rework is where the complexity actually dies; the coordinator built early would be built against the wrong surface list; but doing nothing until then leaves same-commit double-modal writes live on shipping side games. Stage 0 is the honest price of the recurrence lesson (7ccf36e) without building Option C twice.

---

# PART 3 — THE INLINE INPUT LAYER

## A. Capture inventory (what the modals capture today → inline target)

| Input | Today | Level | Inline target |
|---|---|---|---|
| Gross score | ScoreGrid tiles (exists) | per player/hole | KEEP (protect: serif numerals, par tile) |
| Putts | secondary row (exists) | per player/hole | KEEP |
| FIR | secondary row, `holePar >= 4` gate (exists) | per player/hole | KEEP |
| GIR | derived (`isGIR(gross, putts, par)`) | derived | KEEP derived |
| Putt distance | PuttDistModal 4-bucket, sequential per player | per player/hole | Pill row under player, putts-aware (see B) |
| Tags (Sand/Trees/Water/Penalty/Up&Down) | Global LOG THIS HOLE, **hardcoded `'1'`** | per player/hole (type supports; write path doesn't) | Per-player pill row; becomes the detection signal |
| Sandy/Barkie/Arnie confirms | Toast → ManualInputModal (boolean) | per player/hole | Inline confirm pill ("Drew sand-saved — log Sandy?") |
| Poleys distance | ManualInputModal numeric ft — **double-captures vs putt bucket** | per player/hole | Collapses into putt-distance pill (see B) |
| KP / close_shave distance | ManualInputModal numeric, par-3 | per hole | Inline distance pills on par-3, or minimal surviving form |
| Bango (closest to pin) | BBBPrompt modal, player pick | per hole | Inline hole-level quick-select row |
| Hole notes | HoleNotesModal free text | per hole | Stays modal |
| Wolf decision | WolfModal (partner/lone/blind) | per hole, PRE-score | Stays modal |
| Hammer throw/accept/fold | HammerModal + multiplier state | mid-hole | Stays modal |
| 3-putt poker | Passive (derived from putts) | derived | No capture change; persistence only |

## B. The putt-capture fix (folds into rework step 2)

Two logged regressions, one correct target:

1. **Putts-aware conditionality (restore Feb-prototype intent).** Today the prompt fires for every player every hole because the DEFAULT putts value is 2 (`useScoringState.ts:446`) and the gate is `putts > 0`. Correct behavior: putt-distance capture renders only when putts were **actually entered**, with the one-putt case as the headline ("1ST PUTT DISTANCE" — conversion length) and multi-putt as the lag variant ("FIRST PUTT FROM"). **This requires distinguishing entered-2 from default-2** — a data-model decision: either `putts: number | null` defaulting null (ripples into `isGIR(gross, putts, par)` and every putts consumer — poker card dealing, snake, dots), or a `puttsEntered` touched-flag alongside. Flag: this is a REAL schema decision, not a UI tweak; decide before step 2 starts. The inline layer makes the conditionality natural: no putts entered → no pill row, zero prompt cost.
2. **Collapse the double capture.** One capture per putt: the 4-bucket pill row is the single source; Poleys awards derive from the bucket (`Outside 30ft` qualifies), with an optional on-tap expansion for precision — never a second prompt. Delete the Poleys `ManualInputModal` path and the numeric `sideGameEventSlice` write for poleys in favor of a bucket→qualification mapping (unit-test the mapping; the compost's Tier-2 dedup rules apply — one vocabulary, one storage).

## C. Where the complexity actually lives (the genuinely hard parts)

- **Wolf's pre-hole timing.** The wolf decision happens on the TEE, before any score exists — the inline grid is a post-score surface, so Wolf legitimately resists inline treatment and stays modal. The hard part is not Wolf itself but its **auto-open effect racing celebrations** (matrix pair #4) — that's coordinator territory, not inline territory.
- **The default-putts schema decision** (B.1 above) — touches isGIR, poker dealing, snake/dots detection, transition banner. Widest blast radius of anything in the rework.
- **Bango's shape.** Hole-level player-pick doesn't fit the per-player pill grammar — it needs its own inline pattern (a one-row radio under the hole header). Small but novel.
- **Compact/foursome density** — Open Product Decision #3 (compost) gates pill rows in compact mode: 4 player cards + pill rows don't fit current card heights. The spec's protect-list demands compact keeps working. Decision needed BEFORE step 1 lands in compact mode (step 1 can ship solo-mode-first if the decision lags).
- **`handleNext`'s cascade survives the rework.** Even with modals gone, the post-hole order (transition banner → moments → toasts → hole advance) is an imperative sequence; every stage touching it is phone-gated (Part 4A).
- **Hammer persistence gap** (no `hammer_data` on the round row) intersects the ActiveRoundState stage — same schema session.

---

# PART 4 — THE SYNTHESIS

## A. Staged plan

**Standing rule: anything touching `handleNext` / `handlePuttDistSelect`'s imperative sequence is phone-gated per-stage — NOT batchable.** Stages below are marked.

| Stage | What changes | Tests FIRST | Device verification | Batchable? |
|---|---|---|---|---|
| **0 — Gate the ungated pairs** | Render-gates for Bango, 666-transition, wolf-effect vs DormieMoment/PuttDist; `showLeaderboard` into suspended-clause (all Part 2B.1) | None (presentation-only); document each gate as temporary-until-coordinator | Repro attempt of PuttDist×Bango BEFORE the fix (confirm severity), then BBB round + 6-6-6 round + wolf-victory flow after | **NO — phone-gated** (modal presentation timing) |
| **1 — Per-player tag pills** | Tag row moves into PlayerScoreInput; LOG THIS HOLE dies; write path keyed by playerId (type already supports) | Characterization: tags write path (currently forces `'1'` — document as WRONG, migration is the fix) | Foursome round: tag Drew's water ball from Drew's row; solo mode unchanged. **Verify Stableford debt items 1–2 first — same file (ScoreGrid) as unverified Stage 2b chip** | YES (render-layer only) — debt item |
| **2 — Inline putt-distance pills** | Pills under player when putts entered; putts-aware conditionality (schema decision from 3B.1 FIRST); PuttDistModal + its `handleNext` branch + `handlePuttDistSelect` deleted; hole-advance moves back inline | Unit: conditionality (entered vs default), bucket writes to `puttDist` Map shape (characterization of current shape first); isGIR/poker/snake/dots unaffected by schema change (they have tests — run them against the new default) | One-putt label, multi-putt label, no-putts → no row; hole advance correct with and without putts; DormieMoment on trigger hole no longer needs the 7ccf36e gate | **NO — phone-gated** (handleNext surgery) |
| **3 — Inline side-game pills + tags-drive-detection** | Detection consumes tags (sandy requires Sand tag, barky requires Trees); confirm pills inline; ManualInputModal dies for sandies/bark/arnies/poleys; Poleys collapses into bucket mapping; Bango transforms to inline row | Characterization of `detectToastEvents` current behavior (sandy false-positive and barky false-negative documented as WRONG); new tag-driven expectations; poleys bucket→qualification mapping | Sandy fires only with sand tag; barky with trees; poleys awarded from bucket; bango inline; toast queue for remaining auto events | **NO — phone-gated** (detection runs inside handleNext) |
| **4 — ActiveRoundState extension** | Persist wolf/bbb/hammer/puttDist/notes/poker/team-setup **+ (post-Stage-4b additions the spec predates): `matchSides`, `matchSideMode`, `matchScoreMode`, `matchPerspective`** | Serialization round-trip units for every new field (Map↔Record); identity-gate unchanged | Kill + resume mid-round: wolf decisions, hammer, poker pot, putt buckets, match sides all survive | YES (additive persistence + round-trip tests) — debt item covers resume |
| **5 — Scaffolding removal + survivor coordinator** | Delete suspended-clause, detection deferral remnants, Stage-0 gates, 7ccf36e gate; add `useModalCoordinator` (single in-flight id) over DormieMoment / Wolf / 666-transition / Bango-successor / Notes / Leaderboard / Hammer / setup modals | Coordinator unit tests (queue, priority, dismiss); characterization that every auto-fire path requests rather than sets | The full gauntlet: wolf+BBB+666+skins round engineered to stack triggers; each presents serially | **NO — phone-gated** (the whole point is presentation order) |
| **6 — Save & Exit** | Three-way exit dialog; cross-app resume signal (product decision on banner/FAB/Score-tab card) | Lifecycle characterization: save-iff-in-progress invariant (`ea2e797`+`4a8170e`) must hold across the new exit | Save & Exit → browse app → resume; Leave still discards; Finish still clears | **NO — phone-gated** (exit paths = data-loss risk) |

Stage order rationale: 0 protects users during the rework; 1 is the spec's own "smallest validating start" (establishes pill vocabulary, low risk); 2 before 3 because 3's Poleys collapse depends on 2's pill row; 4 anytime after 3 (needs final state shapes); 5 only after 2+3 delete the surfaces the scaffolding guards; 6 independent, last for focus.

## B. What dies

| Artifact | Fate |
|---|---|
| `PuttDistModal` + `puttDistPrompt` state + the `handleNext` defer-branch + `handlePuttDistSelect` | Deleted (Stage 2) |
| `ManualInputModal` (sandies/bark/arnies/poleys paths) + numeric poleys slice write | Deleted (Stage 3) |
| `BBBPrompt` modal | Replaced by inline row (Stage 3) |
| LOG THIS HOLE global section + hardcoded-`'1'` write | Deleted (Stage 1) |
| `suspended` OR-clause (10 pairs), `7ccf36e` dormie gate, Stage-0 gates, detection deferral | Deleted (Stage 5) — replaced by one coordinator |
| `WagerSetup` | Deleted (dead code — any stage) |
| Sandy false-positive / Barky false-negative detection rules | Replaced by tag-driven rules (Stage 3) |
| Double putt capture | Collapsed (Stage 2+3) |

Net: 13 modal surfaces → ~10, but the THREE worst (highest-frequency, auto-fire, same-commit) die; all ad-hoc gating (~40 lines across two files plus everything Stage 0 adds) collapses into one ~80-line coordinator; the freeze class goes from "N² pair management" to "one arbiter."

## C. Risk ranking (safest → scariest)

1. **Stage 4** (persistence) — additive, round-trip-testable, no UI change. Data-loss risk exists but is test-coverable.
2. **Stage 1** (tag pills) — render-layer, additive, the spec's chosen validating start. Only risk: compact-mode density (ship solo/standard first if Decision #3 lags).
3. **Stage 0** (gates) — tiny, uses proven patterns; risk is only that a gate hides rather than fixes a sequencing bug (device repro first).
4. **Stage 6** (Save & Exit) — new affordance on a proven lifecycle; risk concentrated in the exit-dialog rewiring.
5. **Stage 2** (putt pills) — deletes a modal embedded in the imperative sequence AND carries the default-putts schema decision (widest data blast radius: isGIR, poker, snake, dots).
6. **Stage 3** (detection rewiring) — changes WHAT fires, not just how it presents; false-positive/negative fixes are behavior changes users will notice; attribution correctness is the `66f5dd3` lesson.
7. **Stage 5** (coordinator + scaffolding removal) — scariest: removes every guard at once and replaces them with new central code; the failure mode is the original freeze. Mitigate: land coordinator FIRST, prove parity on device, THEN delete scaffolding in a separate commit.

## D. Dependencies & debt-list flags

- **Stableford-live debt (items 1–2, unverified):** Stages 1–2 modify `PlayerScoreInput`/`ScoreGrid` — the same component carrying the UNVERIFIED Stage 2b points chip; `LiveLeaderboard` (touched by Stage 0's suspended-clause addition and Stage 5) carries the unverified Stage 3 leaderboard branch. **Verify debt items 1–2 before Stage 0/1 starts** — otherwise any device anomaly is unattributable between old batch work and new rework work.
- **Team match play debt (items 4–5, unverified):** `MatchPlaySetupModal` is a coordinator citizen (Stage 5) and `matchSides`/`matchSideMode` join the Stage-4 persistence list (the spec's list predates Stage 4b — this plan adds them). **Verify debt items 4–5 before Stages 4–5.**
- **Round-state persistence:** Stage 4 IS the compost's "full round-state restoration" item; it also inherits the hammer `hammer_data` gap (persist it or the Hammer theater-gap product decision (#2) makes it moot — check the decision first).
- **Open product decisions that gate stages:** #3 compact-card height → Stage 1–2 in compact mode; #2 Hammer/3-putt-poker theater → what Stage 4 persists for them; #1 v1 surface area → whether Stage 3 builds pills for games that get hidden.
- **Nothing in this plan assumes batch work is correct.** Stages marked phone-gated must each be verified on device before the next stage starts; the batchable stages (1, 4) join the debt list with two-sided contracts.

---

## Top findings (also logged as compost hand-offs when this executes)

1. **PuttDist × BangoPrompt is scheduled in the same React commit on every scored BBB hole** — ungated, same class as both known freezes. Highest-priority Stage 0 target; needs device repro to confirm manifestation.
2. **The census is 13 modals, not 8; survivors are ~10, not 3–4** — including three auto-fire surfaces that keep colliding after the rework. The coordinator is smaller, not optional.
3. **The putt-prompt regression is a schema bug, not a UI bug** — default `putts: 2` makes "putts > 0" true for everyone always; fixing conditionality requires an entered-vs-default distinction that ripples into isGIR/poker/snake/dots.
