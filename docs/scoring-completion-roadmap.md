# Scoring Completion Roadmap

**Status:** Canonical scope document for all remaining scoring work. Supersedes the cut/defer framing developed during Session 2B's tier-list investigation.

**Decision date:** 2026-05-20

---

## 1. Scope Decision

**All 15 formats and all 17 side games ship in beta. No cuts.**

Comprehensive coverage is a deliberate product differentiator. The wizard's full surface area stays visible to users throughout the build-out — features will show "coming soon" until their engine is delivered, and that is an accepted interim state. This roadmap exists to make that interim window **visible and bounded**, not to hide it.

This decision supersedes any earlier cut/defer recommendations. The prior tier-list investigation correctly identified effort costs per item; those costs now feed **sequencing**, not scope reduction.

---

## 2. Current State Snapshot

**Completed via Sessions 2A + 2B (committed):**

| Format / engine | Status |
|---|---|
| `stroke_play` | Passthrough render — works as-is (correct by design) |
| `stableford` | Engine + handicap-aware wrapper + 14 tests (Session 2A, `calculateNetStablefordTotal`) |
| `modified_stableford` | Engine + full-round wrapper + tests pre-existed (`calculateModifiedStablefordFromRound`) |
| `match_play` | Engine + handicap-aware wrapper + 15 tests (Session 2B, `calculateNetMatchPlay`) |
| `best_ball` | Engine + handicap-aware wrapper + 13 tests (Session 2B, `calculateNetBestBall`) |
| `scramble` | Engine + validator + 10 tests (Session 2B). Handicap deferred to Phase 7. |
| Side games (7 wired): skins, snake, greenies, nassau, dots, wolf, bingo_bango_bongo | Working in production |

**Verification metrics (HEAD `cfb37c1`, pushed to origin):**
- TSC: 34 errors (pre-existing, unchanged across all scoring work)
- Test suite: 100 passed, 0 failed
- 52 new scoring tests added across Sessions 2A + 2B

**Working tree (staged, pending phone verification, NOT committed):**
- `app/create-trip.tsx`, `src/components/RyderCupWizard.tsx`, `src/data/trips.ts` (Session 1C timezone fixes)
- `src/components/scoring/PostRoundSummary.tsx` (Session 2A Stableford render)

---

## 3. Build Order — Completion Sequence

Phases ordered by **user-impact, worst-betrayal-first**. Bucket classifications (free rider / wrap-and-test / new engine / already-working / blocked / promote) are preserved from the prior investigation because they remain accurate about implementation effort — they now feed sequencing, not cut decisions.

### Phase 0 — 3-Putt Poker Promotion (~2 hr)

**Why first:** Highest user-betrayal pattern in the app. Live ticker tracks pot growth and worst-putter during play, then "coming soon" appears at the post-round summary. This is the largest gap between user expectation (set by live theater) and delivered result.

**Bucket:** PROMOTE — partially-built engine + clearest fix.

| # | Action |
|---|---|
| 1 | Extract pot / worst-putter computation from `useScoringState.ts:1026+` into `calculations.ts` as `buildThreePuttPokerResult` |
| 2 | Add unit tests for the engine (pot accumulation, worst-putter tie-breaking, multi-3-putt scenarios) |
| 3 | Wire into `PostRoundSummary` GamesTab — replace fallback "coming soon" with the result render |

**Closes "coming soon" for:** `three_putt_poker`

---

### Phase 1 — Render Pass for Engine-Complete Formats (~4-5 hr, blocks on phone verification)

**Why second:** Multiple engines + wrappers shipped during Sessions 2A/2B but their displays remain gross/net theater. Most of this phase is unblocking work already done; only the live verification gates it.

| # | Action | Bucket | Effort |
|---|---|---|---|
| 1 | Verify and commit the 4 staged working-tree changes (3 timezone fixes + Stableford render from Session 2A) | (verification) | ~30 min |
| 2 | `match_play` render — surface match string ("2&1", "AS", winner) per pair in PostRoundSummary | wrap-and-test render | ~1.5 hr |
| 3 | `best_ball` render — team total per team | wrap-and-test render | ~1 hr |
| 4 | `scramble` (gross) render — team total via `calculateScrambleTeamScore` | wrap-and-test render | ~30 min |
| 5 | `modified_stableford` render — extend Stableford conditional with `formatLabel === 'Modified Stableford'` branch | already-working render | ~30 min |
| 6 | `fourball` composition — render-layer compose `calculateNetBestBall` + `calculateNetMatchPlay` (no new engine) | **FREE RIDER** | ~45 min |
| 7 | `shamble` label-mapping — route format to `best_ball` engine (team scoring identical; the drive constraint is real-world, not scoring) | **FREE RIDER** | ~15 min |

**Closes "coming soon" for:** `match_play`, `best_ball`, `scramble`, `modified_stableford`, `fourball`, `shamble`

---

### Phase 2 — Chapman Wrap-and-Test + Pinehurst Free Ride (~3-4 hr)

**Why third:** Last remaining orphan engine. Same wrap-and-test template applied to Stableford / MatchPlay / BestBall in prior sessions. Pinehurst free-rides on the same engine (description: "Same engine as Chapman").

**Bucket:** WRAP-AND-TEST.

| # | Action |
|---|---|
| 1 | Add `calculateNetChapmanTotal` wrapper around existing `calculateChapmanTotal` engine (handicap-aware following Stableford/MatchPlay/BestBall pattern) |
| 2 | Comprehensive tests — Chapman-specific ball-switching logic, per-hole score resolution, handicap conversion |
| 3 | Render in PostRoundSummary — team total + Chapman-specific result if useful |
| 4 | Map `formatLabel === 'Pinehurst'` to same Chapman engine in render conditional |

**Closes "coming soon" for:** `chapman`, `pinehurst`

---

### Phase 3 — Hammer Extraction (~3 hr)

**Why fourth:** Live state machine already tracks hammer drops per hole in `useScoringState`. Extract to `calculations.ts` for testability + render. Tier-D theater (live state, no summary) — moderate betrayal.

**Bucket:** WRAP-AND-TEST (engine exists inline, needs extraction).

| # | Action |
|---|---|
| 1 | Extract `hammerState` / `hammerResults` logic from `useScoringState` into `calculations.ts` as `buildHammerResult` |
| 2 | Tests — hammer drop accumulation, stacking (re-drops), concession scenarios |
| 3 | Wire into PostRoundSummary GamesTab |

**Closes "coming soon" for:** `hammer`

---

### Phase 4 — New Engine Tier: Formats (~5-8 hr)

**Bucket:** NEW ENGINE — no engine exists; net-new logic required.

| # | Format | Effort | Notes |
|---|---|---|---|
| 1 | `alternate_shot` | ~3-5 hr | Single ball, alternating strokes. Engine validates alternation pattern; outputs team total. Score-entry UI affected (one ball per team, who hit which shot needs tracking for legitimacy). |
| 2 | `greensomes` | ~2-3 hr | Both drive, pick best, alternate from there. Engine takes drives + alternate strokes. |

**Closes "coming soon" for:** `alternate_shot`, `greensomes`

---

### Phase 5 — New Engine Tier: Side Games (~5-6 hr)

**Bucket:** NEW ENGINE (trivial counters in most cases; pure wizard surface for Tier C items).

| # | Side game | Effort | Notes |
|---|---|---|---|
| 1 | `sandies` | ~45 min | Toast scaffolding exists; engine is a counter. Aggregate prompts → render. |
| 2 | `bark` (Barkies) | ~45 min | Same pattern. |
| 3 | `arnies` | ~45 min | Same pattern. |
| 4 | `poleys` | ~45 min | Same pattern. |
| 5 | `trash` | ~45 min | No live theater — pure wizard surface. Build full flow: detect prompt → record event → render result. |
| 6 | `hogans` | ~45 min | Same pattern as `trash`. |
| 7 | `murphys` | ~45 min | Same pattern as `trash`. |

**Closes "coming soon" for:** `sandies`, `bark`, `arnies`, `poleys`, `trash`, `hogans`, `murphys`

---

### Phase 6 — Tier 4 Payout Structure (~8-14 hr)

**Why after engines:** Payouts need engines to feed amounts. The wizard's `perGameStakes` config (winner-takes-all, split-top-3, per-point, per-place, carry-over, Nassau {front9, back9, total}) is captured exhaustively but **read by nothing** today. Auto-settle paths hardcode Nassau $5 and Skins $2 regardless of wizard configuration.

| # | Action | Effort |
|---|---|---|
| 1 | Persist structured `perGameStakes` to `wagers.stakes jsonb` with Zod schema validation at the boundary | ~3 hr |
| 2 | Wire Nassau amount config — replace hardcoded $5 with `wager.stakes.nassau.{front9, back9, total}` | ~1 hr |
| 3 | Wire Skins amount config + honor `carryOver` toggle | ~1.5 hr |
| 4 | Implement `autoSettleStableford` — `payout: 'per_point' | 'per_place'`; per-point: `amount × (winner_pts − avg_pts)`; per-place: top-3 split or winner-takes-all | ~2 hr |
| 5 | Implement `autoSettleStrokePlay` — `payout: 'winner_takes_all' | 'split_top_3'` | ~2 hr |
| 6 | Add `wagers.type` enum entries for new auto-settle types | ~30 min |
| 7 | Expand ledger view UI to show structured wager breakdown if needed | ~1.5 hr |

**Closes payout-config theater for:** `stableford`, `modified_stableford`, `stroke_play`, `nassau`, `skins`. Other engines join as their auto-settle wiring lands.

---

### Phase 7 — Blocked Items (build when dependencies clear)

These items are **blocked on real upstream dependencies, not cut.** They stay visible in the wizard. Their engines are written, ready, or trivial — the gate is external.

| # | Item | Blocked on | Effort once unblocked | Notes |
|---|---|---|---|---|
| 1 | `close_shave` (KP) | **Course Data Quality sprint** — 216/324 courses lack per-hole par metadata needed to identify par-3 holes | ~1 hr | Toast prompt exists. Engine is trivial: "did the team hit the green on a par 3?" Pairs naturally with the par-3 data unblock. |
| 2 | **Scramble handicap** | **Product decision** — USGA fractional formula vs. configurable vs. trip-flag-driven | ~3 hr (new engine + tests + render) | Scramble already ships gross-only via Phase 1. Adding handicap is a polish item, not a correctness blocker. Composted in `dormie-compost.md` with the open product questions. |

**Interim user experience while blocked:**
- KP: continues to show "coming soon" in summary; toast prompts still fire (user sees data being captured, knows result will come)
- Scramble: gross team total renders correctly; handicap simply not yet applied. Trip organizers who want handicap can defer scoring to manual until the formula lands.

---

## 4. Total Effort & Runway

| Phase | Description | Effort |
|---|---|---|
| 0 | 3-Putt Poker promotion | ~2 hr |
| 1 | Render pass — engine-complete formats | ~4-5 hr |
| 2 | Chapman wrap-and-test (+ Pinehurst) | ~3-4 hr |
| 3 | Hammer extraction | ~3 hr |
| 4 | New engine formats — alternate_shot, greensomes | ~5-8 hr |
| 5 | New engine side games — 7 items | ~5-6 hr |
| 6 | Tier 4 payout structure | ~8-14 hr |
| **Subtotal — active build work** | | **~30-42 hr** |
| 7a | KP (when course data unblocks) | ~1 hr |
| 7b | Scramble handicap (when formula decided) | ~3 hr |
| **Grand total — full scope including blocked items** | | **~34-46 hr** |

This is the larger path. It is the deliberately-chosen one. The earlier investigation's "ship list" of ~18-25 hr is dead — it was predicated on cuts that we are not making.

**Parallel cleanup track (audit Tier 2 — sequence flexibly into any phase):**
- Consolidate the 3 Stableford implementations (~2 hr) — pair with Phase 1 verification if a divergence shows up; otherwise standalone
- Extract `evaluateMatch` shared helper for match-string formatting (~1.5 hr) — pair with Phase 1 or Phase 2
- Rename 6-6-6 inline `match_play` segment to `mp_segment` to avoid naming collision with format key (~30 min) — pair with Phase 2

**Implicit per-phase test work:** every engine commit ships with tests (the discipline established in Sessions 2A/2B). Tests are not a separate phase — they are inside each engine's effort estimate.

---

## 5. "Coming Soon" Exposure Tracking

Per-feature visibility table — what the user currently sees, and which phase closes the gap. This is the explicit accountability for the "accept some coming soon during build-out" decision.

### Formats

| Format | Current user experience | Closes at | Notes |
|---|---|---|---|
| `stroke_play` | ✅ Working (gross/net/to-par) | — | No gap |
| `stableford` | ✅ Engine done; render staged pending phone verification | Phase 1 (commit step) | Tests cover engine; render needs device check |
| `modified_stableford` | Renders as gross/net (engine ready, render missing) | Phase 1 | Template match to Stableford |
| `match_play` | Renders as gross/net (engine ready, render missing) | Phase 1 | |
| `best_ball` | Renders as gross/net (engine ready, render missing) | Phase 1 | |
| `scramble` | Renders as gross/net (engine ready, render missing) | Phase 1 (gross); Phase 7b (handicap) | Handicap blocked on product decision |
| `wolf` | ✅ Working via side-game render path | — | Format/side-game distinction muddled but functionally works |
| `low_high` | Renders as inline summary; no formal team-result panel | Phase 1 (optional polish) | Functional today; formalize later if desired |
| `sixsixsix` | Same as `low_high` | Phase 1 (optional polish) | |
| `fourball` | Renders as gross/net | Phase 1 | Free-rider composition: `best_ball` + `match_play` |
| `shamble` | Renders as gross/net | Phase 1 | Free-rider: maps to `best_ball` engine |
| `chapman` | Renders as gross/net | Phase 2 | Orphan engine wrapped + tested + rendered |
| `pinehurst` | Renders as gross/net | Phase 2 | Free-rider on Chapman |
| `alternate_shot` | Renders as gross/net; no score-entry UI for alternating strokes | Phase 4 | Heaviest new-engine build |
| `greensomes` | Renders as gross/net; no score-entry UI for drive selection + alternating | Phase 4 | |

### Side Games

| Side game | Tier (per audit) | Current user experience | Closes at | Notes |
|---|---|---|---|---|
| `skins`, `snake`, `greenies`, `nassau`, `dots`, `wolf`, `bingo_bango_bongo` | (wired) | ✅ Working | — | No gap |
| `three_putt_poker` | A (live ticker + summary theater) | Live pot ticker during play; "coming soon" at summary — **strongest betrayal** | **Phase 0** | First priority |
| `hammer` | D (live state, summary theater) | Live state machine tracks hammer drops; "coming soon" at summary | Phase 3 | |
| `sandies` | B (toast theater) | Toast prompts during play; "coming soon" at summary | Phase 5 | |
| `bark` (Barkies) | B | Same as `sandies` | Phase 5 | |
| `arnies` | B | Same as `sandies` | Phase 5 | |
| `poleys` | B | Same as `sandies` | Phase 5 | |
| `close_shave` (KP) | B (blocked) | Toast prompts during play; "coming soon" at summary | **Phase 7a (blocked)** | Blocked on Course Data Quality sprint |
| `trash` | C (configured but invisible) | Selected in wizard; no in-round signal; "coming soon" at summary | Phase 5 | |
| `hogans` | C | Same as `trash` | Phase 5 | |
| `murphys` | C | Same as `trash` | Phase 5 | |

**Interim window per feature:** roughly equal to "all phases up to and including the closing phase." If phases run sequentially at the effort estimates above, a user picking `alternate_shot` today would see "coming soon" until Phase 4 completes (~17-22 hr of upstream work plus the ~3-5 hr build). Phases can also be **interleaved or parallelized** when the schedule allows — the sequence above is a recommended ordering, not a strict dependency chain (except: Phase 1 commits gated on phone, Phase 6 follows engine phases).

---

## 6. Sequencing Constraints & Notes

**Hard dependencies:**
- Phase 1 partial-blocked on phone verification (4 staged files + Phase 1 new renders need device confirmation)
- Phase 6 (payouts) follows Phases 0-5 — payouts need engines to drive amounts
- Phase 7a (KP) blocked on Course Data Quality sprint
- Phase 7b (Scramble handicap) blocked on Ian's product decision

**Soft sequencing — can be reordered if helpful:**
- Phase 0 (3-Putt Poker) sits at the top of user-impact ranking; can be done at any practical moment — does not gate later phases
- Phase 4 and Phase 5 are independent and can interleave or run in parallel
- Tier 2 cleanups (parallel track listed in Section 4) can fold into any phase

**Render-pass batching (Phase 1):** items 1-7 in Phase 1 should be batched into a single phone-verification window. Verifying each one separately wastes round-trips. The 4 staged files + 6 new renders = 10 items to verify in one device session.

**Coming-soon UX contract:** while a feature shows "coming soon," the codebase should never silently drop user data. Toast prompts for sandies/bark/arnies/poleys/KP capture user input today; the data should persist (in some form) so when the engine lands, **historical rounds get scored retroactively** rather than orphaned. Engineering note for Phase 5 implementers.

**Test discipline carries forward:** every engine commit ships with tests (Sessions 2A/2B template). The test suite grows roughly linearly with the engine count; expect ~150-200 tests by Phase 6 completion.

---

## 7. Decision Log

- **2026-05-20** — Full scope confirmed. No cuts. Comprehensive coverage is product vision. Cuts framing supersededed by this roadmap.
- **2026-05-20** — Scramble handicap held composted (Session 2B) — product decision on formula still open. Gross scramble renders in Phase 1.
- **2026-05-20** — KP held composted (audit) — Course Data Quality sprint dependency. Toast capture continues during interim.
- **2026-05-20** — 3-Putt Poker promoted to Phase 0 — highest user-betrayal in the app.

Subsequent decisions log here as scope or sequencing evolves.

---

End of roadmap. This is the canonical scoring scope document going forward.
