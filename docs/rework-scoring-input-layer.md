# Rework spec: inline per-player input layer for scoring screen

**Status:** Spec only. No code in this chapter.
**Builds on:** the freeze fix, round-state lifecycle, and visual polish landed in 66f5dd3 / ea2e797 / 4a8170e / de55757.
**Estimated effort:** 3-4 focused sessions. Smallest validating start defined at the bottom.

---

## Problem statement

The in-round scoring screen accreted 8 modals over time, each correct for its feature when added, never composed. This caused the multi-modal freeze (fixed: `66f5dd3`), and left a piecemeal input layer where:

- Tags (`Sand / Trees / Water / Penalty / Up & Down`) don't drive detection — they're write-only UI state with no downstream reader.
- Putt distance is captured twice — once via `PuttDistModal` (4-bucket pill grid) and again via the Poleys `ManualInputModal` (free-form numeric in feet) — for the same physical one-putt.
- Side-game attribution goes through a fragile `playerName`-string-match in the confirm handler (silently drops events on duplicate first-names or guest-player spelling).
- Per-hole inputs aren't bound to players: the LOG THIS HOLE tag row hardcodes `getPlayerScore('1')` (the current user), so in foursomes there's no UI affordance to log "Drew hit it in the water on 7."

The rework replaces the modal-stack input model with a **single inline per-player input grammar**: every per-hole input lives on the player's own row, keyed by `playerId` at the type level, with a unified post-hole confirm pattern.

---

## What was already fixed (context only — do NOT re-litigate)

- **`66f5dd3`** — multi-modal freeze closed:
  - `SideGameToast` queue rewrite (setTimeout-in-render → post-commit `useEffect`; `ManualInputModal` always mounted, state-driven via `visible` prop).
  - Option A: side-game detection deferred to after `PuttDistModal` sequence in `handleNext` / `handlePuttDistSelect`.
  - Option B: `suspended` gate on `SideGameToast` blocks manual-event presentation while ANY other scoring-screen modal is open (PuttDist, Wolf, Hammer, BestBall/LowHigh/SixSixSix setup, Note).
  - Deterministic event ids: `${gameKey}-${holeNumber}-${playerId}` (was `Date.now()`-based; two players one-putting in the same millisecond collided on a shared id, and confirming one filtered both out).
  - `playerId` added to `SideGameEvent`; confirm handler attributes directly via `ev.playerId` instead of name-matching.

- **`ea2e797`** — round-state restore on remount. `useScoringState` reads `getActiveRound()` on mount and rehydrates `allScores` + `currentHoleIdx` if a saved round matches by `(courseId + sorted player IDs + ≤24h startedAt)`.

- **`4a8170e`** — orphaned-save cleanup. `clearActiveRound()` now fires on New-Round launch (`handleStartRound`) and on Leave Round confirm (the destructive branch). Combined with the existing post-round / Home Discard clears, the lifecycle is closed: save exists iff there's an in-progress round to resume; every exit clears except Resume.

- **`de55757`** — visual polish: possessive grammar helper (`You's` → `your`), full `SIDE_GAME_DISPLAY` map (poleys/hogans/murphys/3-putt poker/trash), setup-screen safe-area backdrop, scoring-screen top padding, 44pt touch targets in standard mode, number-pad keyboard for putt distance, empty-input guard, redundant Par label removed, empty-state dash muted, disabled prev/next contrast.

These are the platform the rework builds on. The freeze scaffolding (the `suspended` gate, the detection deferral) **becomes redundant** once the colliding modals are gone — see "Cleanup the rework can do" below.

---

## Engineering architecture (the target the rework builds)

### The inline per-player input grid

Every per-hole input — gross score, putts, FIR, GIR, **putt distance**, **tags**, **side-game flags** — moves into a single inline row per player. `PlayerScoreInput` (in `src/components/scoring/ScoreGrid.tsx`) already exists and already owns the gross/putts/FIR/GIR portion; it absorbs the rest.

Each player row, top-to-bottom (composable; not all sections render every hole):

1. **Player header** — avatar, name, running-to-par. (exists)
2. **Score grid** — 1–7 + 8+ tile grid with golf-notation labels and color treatment. (exists; **protect**)
3. **Putts / FIR / GIR** — the secondary row. (exists; 44pt in standard mode)
4. **Putt-distance pills** — `Inside 5ft / 5–15ft / 15–30ft / Outside 30ft`, only renders when `putts > 0` for this player. **Replaces `PuttDistModal`.**
5. **Tag pills** — `Sand / Trees / Water / Penalty / Up & Down`, renders every hole for every player. **Replaces the global LOG THIS HOLE section** (currently hardcoded to player `'1'`).
6. **Side-game flag pills** — `Sandy / Barkie / Arnie / Poley` etc., renders for this player when score conditions match the side-game's rules AND the side game is active in this round. User taps to confirm. **Replaces the side-game `ManualInputModal` for these games.**

### Modals: what gets deleted vs. what stays

| Modal | Verdict | Why |
|---|---|---|
| `PuttDistModal` | **DELETE** | Replaced by inline putt-distance pills under each player with `putts > 0`. |
| `ManualInputModal` (side-game manual prompts: Sandies / Bark / Arnies / Poleys / KP / Bango) | **DELETE** for sandies/bark/arnies/poleys (boolean / per-player numeric flags). **KEEP minimal form** for KP and Bango if they truly need a focused input — but prefer inline distance pills (same vocabulary as putt distance) where possible. |
| LOG THIS HOLE global section | **DELETE** | Replaced by per-player tag pills inside each row. |
| `WolfModal` | **KEEP** | Per-hole strategic decision (Wolf picks a partner or goes lone). Genuinely needs focus. |
| `HammerModal` | **KEEP** | Per-hole strategic decision (double the bet). Genuinely needs focus. |
| `BestBallSetupModal` / `LowHighSetupModal` / `SixSixSixSetupModal` | **KEEP** | Run once per round at format start. Setup, not data capture. |
| `HoleNotesModal` | **KEEP** | Open free-text input justifies modality. |

**Result:** 8 modals → 3–4 modals (the strategic ones + setup ones). The freeze surface area drops dramatically.

### Type-level guarantees

- **`playerId` on every input.** `SideGameEvent.playerId` is already in (`66f5dd3`); extend the same discipline to `tags` (currently lives on `HoleScore.tags`, which IS already per-player — but the WRITE path forces `'1'`; fix the write path, not the type).
- **No more `playerName === 'You'` magic.** Display-string `'You'` is computed at render time from the player's `id === '1'` check, never used for attribution. (`66f5dd3` already removed this from event attribution; the rework finishes the job by removing any remaining hardcoded-`'1'` paths in the input UI.)
- **One source of truth per (player, hole, input).** Tags can no longer drift between "what the user logged via the global pill" and "what the detection layer inferred from score conditions" — the tag IS the input that drives detection.

### Tags DRIVE detection (the key behavior change)

Today's detection (`SideGameToast.tsx:53–62` `detectSideGameEvents`) reads only score conditions: `gross`, `putts`, `par`, `isFir`, `isGir`, `isSave`. Tags are ignored entirely.

The rework inverts this: detection consumes `score.tags` as a first-class signal.

- **Sandy** (`sandies`): require `isSave` AND `tags.includes('Sand')`. Today Sandy fires off `isSave` alone → false positives ("Sandy" prompt with no actual sand).
- **Barky** (`bark`): require `isSave` AND `tags.includes('Trees')`. Today Barky requires `isSave && isFir === false` → false negatives (trees off the tee but FIR wasn't recorded false → no Barky).
- **Arnie** (`arnies`): require par-or-better AND `isFir === false` AND `!isGir`. Tags can refine, not gate.
- **Water / OB / Lost** could drive Murphys/Hogans variants in the future — the tag surface gives us room.

User confirmation lives in the same inline pill row: when conditions match, a "Sandy?" pill appears under the player. Tap to confirm. No modal. The confirmation writes through to `sideGameEventSlice` with the player's `id` keyed directly.

### Collapse the double putt-distance capture

Today: a one-putt triggers BOTH the `PuttDistModal` ("FIRST PUTT DISTANCE", 4-bucket pill grid) AND the Poleys `ManualInputModal` ("How long was your one-putt?", free-form feet). Two prompts, same physical event, different precision and storage.

Rework: ONE capture per putt. Putt-distance pills render under the player when `putts > 0`. The 4-bucket vocabulary suffices for both PuttDist storage AND Poleys awarding (the buckets map cleanly to Poleys thresholds: `Outside 30ft` qualifies, etc.). If Poleys-specific precision is required, render the same pill row with an "Outside 30ft → 35ft / 40ft / 50ft+" expansion — but only on tap, never as a separate modal.

### Round-state restoration: extend `ActiveRoundState`

The current minimum restore (`ea2e797`) covers `allScores` + `currentHoleIdx` only. The rework needs a structured round-state schema anyway — the side-states still reset on remount today and would surprise users who lose mid-round Wolf decisions / BBB assignments / hammer history / putt distances / hole notes.

Extend `ActiveRoundState` (`src/lib/roundStorage.ts:17`) to persist:

- `wolfHoleDecisions: Record<number, WolfHoleState>`
- `bbbHolePoints: Record<number, BBBHolePoints>`
- `hammerResults: Record<number, HammerResult>`
- `puttDist: Record<number, Record<string, string>>` (hole → playerId → bucket)
- `holeNotes: Record<number, string>`
- `sideGameEventSlice` (the confirmed-events per-game per-player per-hole map)
- 3-Putt Poker state: `pokerPerPlayer`, `pokerDeck`, `pokerDeckIndex`, `pokerPot`, `pokerWorstPutter`, `pokerDealtHoles`
- Team-setup state: `lowHighTeams`, `bestBallTeams`, `sixSixSixSegments` (if applicable)

Update `saveActiveRound` to write the full set, and the mount-restore effect in `useScoringState` to rehydrate all of it under the same identity gate. (`Map`s round-trip through `Record`s with the existing `serialize/deserializeScores` pattern — same shape can extend to the new fields.)

### Cleanup the rework can do (freeze scaffolding becomes redundant)

Once `PuttDistModal` and the side-game `ManualInputModal` are deleted in favor of inline pills, the freeze-collision class disappears. At that point the following code can be removed:

- The `suspended` prop on `SideGameToast` (`66f5dd3`) and the OR-of-modal-flags expression at the call site in `app/scoring.tsx`.
- The detection-deferral in `handleNext` / `handlePuttDistSelect` (Option A serialization).
- The `if (manualEvent || suspended) return;` gating in the promotion useEffect.

The `playerId` work and the deterministic-id template stay — those are independently valuable.

The remaining ~3 modals (Wolf, Hammer, HoleNotes; plus 3 once-per-round setup modals) don't collide in practice. If they ever do, a small `useModalCoordinator()` hook covers them — much smaller surface than the original 8-modal coordinator the freeze chase was avoiding.

---

## Visual / UX findings to address (from design diagnostic — structural bucket)

These were flagged by the design review and explicitly deferred from the visual polish pass (`de55757`) because they require the rework:

- **Per-player tag attribution.** Tags currently hardcoded to player `'1'`, visually unbound to any player. Bind to player rows.
- **Double putt-distance prompt.** Two prompts for the same physical putt. Collapse to one (per "Collapse the double putt-distance capture" above).
- **Inconsistent post-hole prompt chrome.** Modal (putt dist) vs banner (Wolf banner above the score grid) vs toast (Sandy semi-auto) vs ManualInputModal (Poleys/KP) — four grammars. Unify into ONE inline post-hole confirm grammar (pill row inside player card).
- **Dual "Side Games" controls.** The status-bar ticker AND the expandable panel share the name "Side Games." Consolidate — either the bar IS the panel (tap to expand) or one of them goes.
- **Compact/foursome touch targets still below 44pt.** Standard mode was lifted in `de55757`; compact mode kept ±16pt icon buttons because bumping them forces a taller card and breaks 4-on-screen density. Needs a card-height redesign decision in the rework — either taller compact cards, or a different compact layout (e.g., 2-row card with putts on the second row), or a per-row drawer that expands the active player.

---

## New feature to design in: Save & Exit / pause round

Currently the only mid-round exits are **Leave** (discards via `clearActiveRound`) and **finish** (post → clear). There's no "**pause this round and use the rest of the app, resume later**" path — the user has to fully kill the app to get the Home Resume prompt to appear.

The round-state lifecycle (restore + clear) is already built (`ea2e797` + `4a8170e`); this is a missing exit **affordance**, not missing infrastructure. The redesign should answer:

1. **Where does Save & Exit live?** Top-bar action next to Leave? A two-option dialog when the user taps the close button (`Save & Exit / Leave (discard) / Cancel`)? The latter is probably right — turn the destructive Leave dialog into a three-way exit decision.
2. **How does the rest of the app signal an in-progress round?** Today the Home tab's interrupted-round detection (`getActiveRound() + holesCompleted > 0`) only shows up after a kill. With Save & Exit, the user could be anywhere in the app. Surface options:
   - Persistent header banner across all tabs ("Round in progress at Hermitage — tap to resume").
   - Floating action button when not on the Score tab.
   - Score tab itself shows the active-round resume card prominently at the top instead of (or alongside) the New Round wizard.
3. **What clears the save?** Save & Exit doesn't clear (that's the whole point). Resume restores. Finish clears (existing). Leave (now distinct from Save & Exit) clears (existing in `4a8170e`). User must be able to explicitly discard from the resume affordance (already exists via Home tab's `handleDiscardRound`).

Design this AS PART OF the exit model. Don't bolt it on after.

---

## Things to PROTECT (do not degrade in the rework)

The design review explicitly called these out as good and not to touch:

- **The score-entry grid.** Big serif numerals, green Par-highlighted tile, warm-dark palette, gold active-hole chip. Called broadcast-quality. Don't water down tile size or serif numerals when adding the new pill rows.
- **Per-player naming the modals already do correctly.** "Kara's putt" (`possessive()` helper, `de55757`). Extend this to the new tag pill row — when a sandy auto-detects on Drew's hole, the pill should say "Drew sand-saved par — log Sandy?" or similar, not "Sandy?" floating context-free.
- **The par-3 logic that drops the FIR box.** `showFIR = holePar >= 4` in `PlayerScoreInput`. The app knows golf. The new tag row should similarly drop tags that don't apply on par-3s (probably none — Sand/Trees/Water all apply).
- **Solo vs compact view modes.** `viewMode === 'solo'` and `viewMode === 'all' && players.length > 2`. The rework must work in both. Compact is the harder constraint — see touch-targets bullet above.
- **The freeze fix.** Don't reintroduce simultaneous-modal patterns. The inline grid IS the structural solution; if a feature feels like it wants a modal, that's a smell.

---

## Effort estimate

**~3–4 focused sessions.** Rough phasing:

| Step | Effort | Lands |
|---|---|---|
| 1. Per-player tag pills (move from global section to PlayerScoreInput row). Tags become per-player; LOG THIS HOLE section deleted. | ~0.5 session | Foursome tag inputs work; design language for the new pill row established. |
| 2. Inline putt-distance pills (replace `PuttDistModal`). Pills render under each player with `putts > 0`; existing `puttDist` Map writes preserved. | ~1 session | `PuttDistModal` deleted; putt distance captured once per putt. |
| 3. Inline side-game flag pills (replace `ManualInputModal` for sandies/bark/arnies/poleys). Detection writes a pending flag onto the player row; user taps to confirm inline. **Tags drive detection** swap happens here. | ~1.5 sessions | `ManualInputModal` deleted for these games; sandy/barky false-positives/negatives fixed; Poleys numeric capture collapses into the putt-distance pill (same vocabulary). |
| 4. Extend `ActiveRoundState` schema + restore-effect to cover side-states. Persist + restore wolf/bbb/hammer/putt/notes/poker/team-setup. | ~0.5 session | Full round-state restoration. The minimum-fix from `ea2e797` graduates to complete. |
| 5. Remove freeze scaffolding: `suspended` gate, detection deferral, gated promotion. Optionally introduce small `useModalCoordinator` for the remaining ~3 strategic modals. | ~0.25 session | Codebase clean. |
| 6. Save & Exit / pause affordance: dialog redesign + cross-app resume signal. | ~0.5 session | Exit model complete. |

**Smallest validating start:** **Step 1 (per-player tag pills) on its own.** Low risk, high learning. Establishes the per-player pill vocabulary in code. If it lands cleanly and feels right on device, Steps 2 and 3 are the same pattern repeated. If it feels cramped or hard, the rework needs more design before the bigger steps. Recommend phone-verifying Step 1 standalone before committing to the full chapter.

---

## Out of scope for this rework

- The format engines themselves (Stableford/MatchPlay/etc. wire-up, payout structure overhaul). That's the Scoring Engine Integration Sprint (separate compost, `docs/audits/2026-05-17-scoring-engine-audit.md`).
- Course data quality (216 of 324 courses missing per-hole pars). Separate sprint.
- Hole-aware side-game infrastructure (KP par-3 metadata). Blocks one bullet in Step 3 but doesn't gate the whole rework.
- Claude Design pass on the rest of the app. Pre-beta workstream tracked in compost.

---

## Open questions for the design pass

These should be answered before code starts on each step:

- **Compact-card height in foursomes.** Taller cards (sacrifice density) vs. drawer pattern (active-player expansion) vs. per-row collapsible inputs?
- **Save & Exit dialog flow.** Two-tap (Close → Save / Leave / Cancel) vs. dedicated Save button next to Close?
- **Cross-app in-progress signal.** Banner, FAB, or just the Score tab's first-card affordance?
- **Tag → detection mapping.** What's the canonical list (Sand → Sandy; Trees → Barky; Water → ?; OB → ?; Lost → ?; Up&Down → ? — does Up&Down map to anything or is it pure logging)?
- **Side-game pill UX.** Single-tap to confirm? Confirm-and-undo? Long-press to reject? Match an existing affordance pattern from the wizard or score grid for consistency.
