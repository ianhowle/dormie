# Dormie Design DNA

**Date created:** 2026-05-04
**Purpose:** Single canonical reference for Dormie's design system, philosophy, and visual language. Consolidated from multiple prior design conversations in claude.ai across Jan 2026 – Apr 2026. Use this as the orientation doc for any future design-focused conversation.

---

## The Philosophy

Dormie is a premium golf competition and trips app for friend groups who take golf seriously. The design language is built around a single core idea: **stillness and presence as a flex.**

ESPN uses velocity and motion. Dormie uses restraint. The Masters app, WHOOP, and PGA Tour broadcasts inform the visual language — quiet authority, broadcast-quality data presentation, editorial typography that commands respect.

Restraint IS the flex. Color used with meaning, not decoration. Every pixel intentional.

The brand voice is the 19th hole at the clubhouse: confident, simple, golf-specific, warm. Knowledgeable but never lecturing. Premium but never pretentious.

---

## Visual References

The design DNA is informed by these specific products. When in doubt, look at what these do:

- **The Masters app** — understated luxury, Augusta green and cream palette, refined editorial typography, private club feel, broadcast-quality leaderboard treatment
- **WHOOP** — layered dark surfaces (cards slightly lighter than background, no visible borders), data-as-storytelling, restrained color use, premium feel through depth not decoration
- **PGA Tour broadcasts and app** — color-coded scores (red/green for under/over par), broadcast leaderboards with green header bars, gold position numbers for top 3, tournament-scale data density
- **Apple Fitness app** — celebration energy, achievement motivation, bold data visualization (used selectively for moments)
- **ESPN** — informs what NOT to do (Dormie deliberately does the opposite: quiet not loud, slow not fast)
- **Stripe Dashboard** — informs information density, type hierarchy, restraint in UI chrome

---

## Color System

Dark mode is the primary, default experience. Light mode exists but is secondary. Augusta green and gold are the brand. Use color with meaning — never as decoration.

### Greens

| Token | Hex | Usage |
|-------|-----|-------|
| Augusta green | `#006747` | Logo, primary brand, CTA buttons, brand mark |
| Masters green | `#1E4D2B` | Headers, leaderboard, competition mode, gradient starts |
| Field green | `#2D6A3F` | Gradient endpoints, secondary green |

There has been some historical drift in green hex values across iterations (`#046A38`, `#1E4D2B`, `#006747` have all appeared at different stages). The current canonical primary is **`#006747`** as used in the live codebase tokens. Treat the others as variants for gradients and headers, not as primary brand color.

### Golds

| Token | Hex | Usage |
|-------|-----|-------|
| Brand gold | `#C9A227` | Logo flag, warm gold, brand mark accents |
| Championship gold | `#D4AF37` | Awards, premium moments, section headers, "trophy" UI |

Gold is reserved for championship moments and premium UI. Do not use gold for routine UI chrome — it loses meaning when used decoratively.

### Supporting

| Token | Hex | Usage |
|-------|-----|-------|
| Teal | `#2A9D8F` | Positive states, confirmations, user highlights, "you" indicator |
| Urgent red | `#C44B4F` | Alerts, bogey+ scores, error states |
| Live state | `#E07857` | Pulsing badge for in-progress trips (warm amber, not red) |

### Dark Mode Surfaces

| Token | Hex | Usage |
|-------|-----|-------|
| Dark BG | `#0D0A06` | Primary dark mode background (current canonical) |
| Dark Surface | `#151312` | Card surfaces |
| Dark Elevated | `#1A1816` | Elevated cards, modals, sheets |
| Text Dark | `#E8E4DE` | Primary text on dark |
| Muted | `#8A857F` | Secondary text, labels, captions |
| Hairline | `#2A2724` | Thin 1px borders, dividers |

Layered dark surfaces are part of the visual language — cards are slightly lighter than background, with NO visible borders. Depth comes from luminance, not strokes. WHOOP-style.

Note: `#141210` was used in earlier iterations as Dark BG. The codebase has since standardized on `#0D0A06` as the deeper, warmer black that better complements the green palette.

### Light Mode Surfaces (secondary)

| Token | Hex | Usage |
|-------|-----|-------|
| Light BG | `#FAF8F4` | Warm cream background (Masters-inspired) |
| Light Surface | `#FFFFFF` | Cards |
| Light Elevated | `#F5F1EB` | Elevated surfaces |
| Text Light | `#1A1A1A` | Primary text on light |

Light mode exists. Dark mode is the default. Most users will never see light mode.

---

## Typography

Editorial quality. Broadcast-grade where data appears. The typography is one of Dormie's most differentiated elements.

### Type System

- **Georgia serif** — headlines, all key numbers (scores, rankings, handicaps, stats, countdowns), data displays. This is the workhorse. Editorial weight, broadcast quality, instantly recognizable as Dormie.
- **System sans-serif (SF Pro on iOS, system on Android)** — UI labels, body copy, navigation, captions. Apple-level clarity for non-data UI.
- **Playfair Display Bold** — the "DORMIE" wordmark only. High contrast serif with thick/thin stroke variation.

### Type Rules

- All numbers that matter use Georgia serif. Scores, handicaps, rankings, countdowns, stats. No exceptions.
- Negative letter-spacing on large display numbers (broadcast style — tournament scoreboards do this).
- Section headers use small caps with letter-spacing. Example: "LATEST" / "SIDE GAMES" / "UPCOMING" / "BUCKET LIST" / "TRIP MOMENTS".
- Section header color: brand gold `#D4AF37` for premium sections, muted for utility sections.
- Type scale is intentional — large numbers should feel commanding, body copy should feel confident not cramped, captions should feel small but not afterthoughts.

---

## Design Rules (Hard Constraints)

These are non-negotiable. They define Dormie's visual identity.

### Sharp Edges Everywhere

**Zero `border-radius` on UI elements.** Cards, buttons, inputs, toggles, sheets, modals — every element has sharp square edges.

The only exceptions:
- Circular avatars
- App icon itself (uses standard iOS/Android rounded corner masks)

This is a KEY brand differentiator. Every other modern app uses rounded corners. Dormie's sharp edges are immediately recognizable. If you see rounded corners in Dormie, fix them.

### Pinstripe Texture on Green Headers

Masters green gradient headers should have a subtle diagonal pinstripe overlay at 3% white opacity. This is a small detail that adds editorial weight to header sections. Apply to: Home header, Leaderboard header, Profile header, Score setup header, any prominent green gradient section.

### No Gradients in the Logo

Logo marks use flat fills only. Subtle gradients on app headers are acceptable. The logo itself is solid color.

### Color Restraint

Gold is for championship moments. Green is brand. Teal is "you." Red is urgency. Color is signal, not decoration. If you find yourself using color to add visual interest, find a different solution.

---

## Logo and Wordmark

### Logo Mark — The D Monogram

A bold serif **"D"** in Augusta green `#006747`. A small gold `#C9A227` flag extends UPWARD from the top-right of the D's spine — like a flag planted at a summit. Solid letterform, no door-cutout treatment, no negative space inside the D.

The flag is a small, delicate accent. The D is the hero. Designed by Gary on Fiverr (April 2026) after multiple revisions to remove cutout treatments and land on the clean "flag at the summit" execution.

### Wordmark — DORMIE

"DORMIE" in **Playfair Display Bold**, Augusta green `#006747`, with letter-spacing `3px`. The flag from the logo replaces the dot of the I (or sits above the I as a small accent — both treatments are part of the family).

### Lock-ups

Horizontal: D monogram + DORMIE wordmark side by side.
Vertical: D monogram above wordmark.

Both use Augusta green for letterforms, brand gold for the flag accent.

---

## Component and Pattern Library

### Layered Dark Surfaces (WHOOP pattern)

Cards on dark mode are SLIGHTLY lighter than the background. Do not use visible borders. Depth comes from the luminance step.

- Background: `#0D0A06`
- Card surface: `#151312` (one step lighter)
- Elevated card or modal: `#1A1816` (two steps lighter)

If a card needs to "pop," elevate it via background color, not by adding a border or shadow.

### Section Headers

Small caps. Letter-spaced. Gold (`#D4AF37`) for premium sections. Muted (`#8A857F`) for utility sections.

Examples in current codebase: "LATEST" / "SIDE GAMES" / "TRIP MOMENTS" / "HEAD TO HEAD" / "EXPLORE" / "STATS" / "GROUP RANKINGS".

### Broadcast-Quality Leaderboards

Inspired by Masters and PGA Tour broadcast graphics:

- Green header bar at top of leaderboard table
- Position numbers in gold for top 3
- Net score column with conditional coloring (red for over par, green for under par)
- Proper column grid alignment — every row aligns precisely
- Tight, purposeful spacing — broadcast-precision data density
- Current user row highlighted with subtle green accent

### Loading States

**Skeleton shimmer, not spinners.** A spinner says "the app is working." A shimmer says "your content is arriving." Dormie uses skeleton states for all primary content loads.

Branded pull-to-refresh animation — a custom golf ball or flag-pin animation, not the default iOS spinner. (Currently in compost as a polish pass; verify implementation status.)

### Animations and Interactions

- **Spring animations on card press** — scale to `0.97` with bounce-back. Light haptic on tap. Premium tactile feedback.
- **Slow fades for cinematic moments** — when celebrating wins, achievements, or trip transitions. ESPN uses velocity; Dormie uses stillness.
- **Pulsing badges** — Live Trip indicator pulses warm amber `#E07857` on a slow 800ms cycle. Used sparingly for in-progress states.
- **Haptic feedback** — light haptic on all primary actions (tap chip, select pill, submit form). Success haptic on completed actions. Error haptic on validation failures.

### Image Treatments

- **Full-bleed photography** for opening moments — course photos edge-to-edge, no margin. Used on splash, course detail headers, trip headers.
- Photography should feel premium and editorial — golden hour, professional, evocative. Avoid stocky generic golf imagery.

---

## Cinematic Moments (Reserved Treatments)

Some UI is reserved for emotional payoff moments. These should feel rare and earned. See `docs/dormie-cinematic-exploration.md` for the full strategic exploration.

The cinematic palette includes:
- Champion crowning animation (currently built but not user-tested)
- Hole-in-one celebration card
- Live Trip welcome moment
- Post-trip recap (planned, post-beta)
- Year-in-review Season recap (planned, post-beta)

When designing cinematic moments, the rules above bend slightly — gold is more abundant, gradients are richer, animations are slower and more dramatic. But sharp edges and Georgia serif still hold.

---

## What Dormie's Design Is NOT

Equally important to define what we're not. If a design move trends toward any of these, course-correct.

- **Not a tech startup look.** No SaaS gradients, no rounded corners on every surface, no inflated whitespace, no oversized icons. Dormie is editorial, not techy.
- **Not Pokémon Go.** No badges, levels, streaks, daily quests, gamification loops. Dormie respects the user's relationship with golf — it doesn't manipulate it.
- **Not Instagram.** No public feeds, no following, no likes on strangers' content. Dormie's social layer is friend-graph only.
- **Not a casino.** No flashing animations, no celebration overload, no "you won!" interrupts. Wins are quiet. The trophy speaks louder than the confetti.
- **Not corporate.** No flat illustrations of generic figures playing golf. No clip-art. No stock imagery. Real photography or nothing.
- **Not minimalist for its own sake.** Restraint is purposeful, not empty. Information density is high where data matters. White space is editorial spacing, not lazy spacing.

---

## Design History — Where This Came From

Dormie's design DNA was developed across multiple conversations in claude.ai over Jan – Apr 2026. The major milestones:

- **Jan 17, 2026** — original chat where the name "Dormie" was workshopped and the foundational Masters/Augusta DNA was established. First interactive prototype with leaderboard, matchups, scoring screens.
- **Feb 28, 2026** — sophistication refinement. Established Georgia serif as primary, sharp edges as core constraint, broadcast-quality leaderboard pattern. The 19,500-line single-file React prototype represented the design's most complete pre-Claude-Code expression.
- **Apr 1, 2026** — visual polish audit identifying drift in the implemented app. Reinforced zero border-radius rule, pinstripe texture overlay, gold accent treatment for section headers.
- **Apr 7, 2026** — logo design with Gary on Fiverr. Multiple iterations to land on the clean D monogram with flag-at-summit treatment, Playfair Display wordmark, exact hex colors.
- **Apr 10, 2026** — Figma integration as a design exploration tool. Full token table documented for the first time. Screen-by-screen prompt approach explored but not adopted as primary workflow (screen-by-screen description-to-Claude-Code remains the actual workflow).
- **May 2026** — current consolidation. This document.

---

## How to Use This Doc

For every future design-focused Claude conversation about Dormie:

1. Open the new chat with: "Design session for Dormie. Read `docs/dormie-design-dna.md` for context, then [the specific design task]."
2. Reference specific sections of this doc as needed during the conversation. Example: "Apply the layered dark surfaces pattern to this card." "Make the leaderboard match the broadcast-quality leaderboard pattern."
3. When a design decision is made that adds to or modifies the design DNA, update this doc. It is the canonical reference.
4. For implementation, describe the design verbally in detail, then hand off to Claude Code. Do NOT upload design files or expect Claude Code to read this doc end-to-end during build sessions — Claude Code's context is best used for code, with design intent communicated explicitly.

For non-design conversations, this doc does not need to be in context. The strategy doc and the relevant feature spec are the right primary references.

---

## Companion Docs

- `docs/dormie-strategy.md` — strategic context, target user, monetization, competitive positioning
- `docs/dormie-compost.md` — append-only running idea capture
- `docs/dormie-cinematic-exploration.md` — strategic exploration of cinematic features (post-beta)
- `docs/trips-product-vision-2026-05-03.md` — Trips workstream vision

---

*End of design DNA. This is the source of truth for Dormie's visual language. Update it when the language evolves; reference it whenever design work begins.*
