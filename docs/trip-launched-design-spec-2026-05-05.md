# Trip Launched — Cinematic Moment Spec

**Status:** Locked · 2026-05-05
**Phase:** 1.9 (cinematic moments)
**Component:** `src/components/cinematic/TripLaunched`
**Driven by:** `progress` (0..1) or wall-clock `now` (ms)

## Design Principle

Trip Launched is the first of Dormie's "second-moment" cinematic beats — fired
when a trip becomes real, *not* on form submit. The user is the agent of
"this trip is now real": floor logic governs the **enable state** of the
Launch button, never an auto-fire trigger.

The visual language is Augusta + Masters broadcast: italic Georgia hero,
two golds (brandGold for chrome, championshipGold reserved for the
destination glow sweep + the "you" underline), cinemascope letterbox, and
restrained haptics that ramp through the roll call.

## Animation — Four Beats

Total duration scales with roster size. Baseline (1–4 players): 4800ms.
12-player Ryder Cup at 110ms cadence: ~6500ms.
`computeTotalDuration(players, format)` returns the actual end time.

### Beat 1 — Arrival (0–1000ms)

| t (ms) | Element | Easing | Notes |
|---|---|---|---|
| 0 → 600 | Letterbox bars slide in | cubicOut | Black 72px bars from top + bottom edges |
| 100 → 700 | Stage gradient fades in | cubicOut | Masters green vertical gradient |
| 400 → 900 | Gold corner brackets draw | cubicInOut | 4 corners simultaneously, 22px L-strokes |
| 650 → 900 | 3% white pinstripe pulse | cubicOut | One-shot lighting |
| 700 → 1000 | Kicker (DORMIE · TRIP LAUNCHED) | cubicOut | Opacity + 8px translateY |
| **0** | **Haptic: impactHeavy** | — | Single tactile commit |

### Beat 2 — Recognition (1000–2500ms)

| t (ms) | Element | Easing | Notes |
|---|---|---|---|
| 1000 → 1700 | Destination rises | cubicOut | translateY 24→0, opacity 0→1 |
| 1500 → 2300 | Gold glow sweeps L→R | cubicInOut | championshipGold 80px hairline, screen blend |
| 1900 → 2200 | Date stack appears | cubicOut | Opacity only — no translate |
| 2100 → 2500 | Gold hairline draws L→R | cubicInOut | Settles at 42% stage width |
| **1700** | **Haptic: impactLight** | — | Soft tick when destination lands |

### Beat 3 — Momentum (2500ms → variable)

Roll call. Each avatar drops in sequence with ascending haptic intensity.

- **Cadence:** 180ms (default) · 110ms (N ≥ 9, including Ryder Cup)
- **Per-avatar:** 320ms cubicOut · opacity 0→1, translateY 8→0
- **Haptic ramp** (capped at 6 hits): Light, Light, Medium, Medium, Heavy, Heavy
- **Sentence type-on:** starts 200ms after last avatar lands · 30ms/char · max 800ms
- **"You" underline** (signature gesture): starts 200ms after sentence completes · 380ms cubicInOut L→R draw · selection haptic at start

`youAt: -1` from `buildSentence()` suppresses the underline (undrafted Ryder Cup state — captains are the actors, not "you").

### Beat 4 — Invitation (after Beat 3)

| Offset (ms) | Element | Easing |
|---|---|---|
| 0 → 300 | Stakes credit fades in | cubicOut |
| 200 → 600 | CTA arrow extends 14px | cubicOut |
| 400 | Live amber dot begins pulsing | 1200ms loop |
| 600 | CTA tap target activates | — |
| **600** | **Haptic: impactLight (ctaReady)** | — |

## Tokens (verbatim — see `tokens.jsx`)

### Colors

- `bg`: `#000000`
- `mastersGreen`: `#1E4D2B` · `greenDeep`: `#0D2818`
- `brandGold`: `#C9A227` (chrome) · `championshipGold`: `#D4AF37` (destination glow + "you" underline ONLY)
- `goldGlow`: `rgba(212,175,55,0.55)`
- `teamUsaRed`: `#7A2222` · `teamEuropeBlue`: `#1E3A5F` (defaults; overridable)
- `text`: `#E8E4DE` · `textMuted`: `#8A857F` · `textTertiary`: `#6B6560`
- `liveAmber`: `#F2A93B`

### Type

- Hero: Georgia italic — adaptive 64/52/44/36pt by char count
- Date: Georgia 22pt, tracking -0.4
- Sentence: Georgia italic 18pt, tracking -0.2
- Kicker / stakes / CTA: SF Pro Text uppercase tracked
- Tracking: kicker 4 · stakes 2.4 · CTA 2.8

### Spacing

- Letterbox bar: 72px · stage padding: 28px X / 32px top
- Destination block: top 100px, height 110px (reserved zone)
- **layoutShift:** dateBlockTop / hairlineTop / avatarRailTop all push +36px when hero wraps (≤44pt + ≥14ch), +14px when subtitle present
- Date subtitle marginTop: 14px (raised from 8 to fix two-line crowding)
- Avatar wrapper paddingTop: 12px (uniform — reserves captain-pip space)
- Ryder Cup label offset: 32px (label-top to avatar-top → ~21px visible gap)
- Ryder Cup inter-rail gap: 32px

## Adaptive Time Logic

```
ms = trip.date - now
if ms < 24h:  teeTime mode    → "8:42 AM" · "TODAY" or "TOMORROW"
if ms < 30d:  dateRange mode  → "OCT 15 – 17" · "2026"
if ms ≥ 30d:  countdown mode  → "T-127 DAYS" · "OCTOBER 2026"
```

`endDate` triggers the range form. Same-month optimization: drops the second month abbrev.

## Roster Scaling

| N | Avatar | Gap | Rows | Cadence | Sentence |
|---|---|---|---|---|---|
| 1 (solo) | — | — | — | single Medium haptic | "Just you." |
| 2–4 | 44px | 8px | 1 | 180ms | full names list |
| 5–8 | 40px | 6px | 1 | 180ms | full names list |
| 9–12 (flat) | 36px | 5px | 2 | 110ms | "X, Y, Z, and N others — including you." |
| 12 (Ryder Cup) | 36px | 5px | 2 (one per team) | 110ms | parametric (see below) |

"You" anchors row 1 leftmost in standard rails. **Exception:** undrafted Ryder Cup renders in original order — captains differentiate by pip, not position.

## Ryder Cup States

Detected by `format === 'ryderCup'` × team assignment.

### Undrafted (`!players.some(p => p.team)`)

- Single neutral rail · 2 rows of 6 · symmetric (no "you" anchoring)
- Gold-bordered "DRAFT NIGHT TBD" pin above the rail
- Captain pip: 7×7 championshipGold rotated diamond, `top: -12`, 6px glow — both captains marked
- Sentence: *"Twelve players. Two captains. Draft night to come."*
- `youAt: -1` → no underline
- Stakes: `RYDER CUP · DRAFT PENDING`

### Drafted — Default Teams

- Two team rails (A on top, B below) with parametric labels
- Default colors: oxblood `#7A2222` / royal `#1E3A5F`
- "You" anchors leftmost in home team's row
- Sentence: *"Team A's 6 vs. Team B's 6 — and you on Team A."*

### Drafted — Custom Teams

- `trip.teams = { a: { name, color, glow }, b: { name, color, glow } }`
- Player team key accepts `'a'/'b'` (new) or `'usa'/'europe'` (legacy)
- Possessive handles trailing `s`: `"The Generals'"` not `"The Generals's"`
- Example: *"The Generals' 6 vs. The Outlaws' 6 — and you on The Generals."*

## Multi-Destination Trips

`trip.tripName` overrides `trip.destination` as italic Georgia hero. Subtitle becomes the courses or regional context.

Type tiers:
- ≤ 9 chars → 64pt single line
- 10–13 → 52pt single line
- 14–19 → 44pt up-to-2 lines
- 20+ → 36pt up-to-2 lines

The italic Georgia treatment carries personal trip names ("Sand Belt Run", "The Big Dawgs Invitational") as well as place names — arguably better, because it speaks in the user's voice.

## Fire-Floor Logic

The minimum truth table for firing Trip Launched. Three required signals:

| Signal | Required | Validation |
|---|---|---|
| **Identity** | yes | `destination` OR `region` OR `tripName` non-empty |
| **Time** | yes | real `Date` or window — NOT "TBD" |
| **People** | yes | `players.length >= 1` (solo is valid) |

`format` is NOT required — falls back to `"GAME TBD"` stakes line.

**Below the floor:** Launch button is disabled with explanatory copy ("Add a date to launch" / "Add a destination to launch" / "Add at least yourself to launch"). User completes missing info, button enables.

**Above the floor:** user has TWO choices — "Save as draft" or "Launch trip." Trip Launched fires from exactly one trigger: user taps "Launch trip." Predictable, user-controlled, emotionally correct. The cinematic doesn't fire while the user is in line at Starbucks because Drew tapped Accept — that would be intrusion, not magic.

## Haptic Pattern

iOS does not expose continuous pitch; we ramp `expo-haptics` ImpactFeedbackStyle intensity instead.

```
Beat 1 arrival:    impactHeavy at 0ms
Beat 2 destination: impactLight at 1700ms
Beat 3 roll call:  ramp [Light, Light, Medium, Medium, Heavy, Heavy]
                   fired AT each avatar land, max 6 hits
                   (longer rosters batch the remainder)
Beat 3.5 you-line: selection (soft click) at youUnderlineStart
Beat 4 cta-ready:  impactLight at 4600ms (Beat 4 +600ms)
```

## Sound Design

**OFF by default.** Dormie's restraint principle: a cinematic moment that plays a sound on a quiet morning is an interruption, not a celebration.

Optional v2 consideration (gated by user preference): a single low-volume "starter's bell" at letterbox-close. Not implemented in v1.

## Edge Cases

- **Missing avatar:** monogram on deterministic tonal background. 6-color warm low-saturation palette. `hash(name) % palette.length`. Georgia 18pt 700 weight.
- **Super-long destination:** falls into 36pt 2-line tier (20+ chars). Tested up to 27ch ("Tennessee Three-Course Tour") with `text-wrap: balance`.
- **Single-day trip:** `endDate` omitted → just `MMM D` + year. No range dash.
- **Multi-day trip:** `endDate` present → `MMM D – D` (same month) or `MMM D – MMM D` (cross-month). Year on second line.
- **Solo trip:** avatar rail dropped entirely. Sentence: *"Just you."* (underlines "you"). Stakes: `QUIET ROUND · NO STAKES` if no game set. Single Medium haptic replaces the roll call.
- **TBD time / missing date:** below-floor — Launch button disabled.
- **Ryder Cup with one captain assigned, one open:** treats as undrafted; sentence: *"Twelve players. Draft night to come."* (drops "Two captains.").

## Future Threads (Phase 2+)

Trip Launched is one beat in a multi-stage anticipation arc. Other state-change moments worth their own cinematic:

- **Roster Locked** — final RSVP arrives
- **Tee Times Set** — pairings confirmed
- **Draft Night** — Ryder Cup teams assemble
- **Trip Eve** — T-1 day countdown crosses the threshold

Each fires from a real state-change trigger, user-controlled where appropriate. The framework: **Dormie celebrates state changes, not form submits.**
