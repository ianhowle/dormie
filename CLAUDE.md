# Dormie Golf App

## Overview
Premium golf competition app for friend groups. Social scoring, trip planning, season-long competitions, and course leaderboards.

## Tech Stack
- Expo React Native with TypeScript
- Supabase for backend (auth, database, real-time)
- React Navigation (bottom tabs + stack navigators)

## Design System
- Dark mode primary: bg #141210, cards #1A1816, elevated #262320, text #E8E4DE, textMuted #6B6560
- Light mode: bg #FAF8F4, cards #FFFFFF, elevated #F5F1EB, text #1A1A1A, textMuted #8A857F
- Accent colors: teal #2A9D8F, gold/champagne #D4AF37, Masters green #1E4D2B, urgent red #C44B4F
- Fonts: Georgia serif for headings, numbers, and hero text. System sans-serif for body and labels.
- No border-radius anywhere — sharp edges throughout (this is a key brand differentiator)

## App Structure
5 bottom tabs: Home, Score, Trips, Leaderboard, Profile
Each tab has its own stack navigator for drill-down screens.

## Conventions
- All components use the shared theme from src/theme/
- Use Georgia serif font for any number that matters (scores, rankings, countdowns)
- Gold (#D4AF37) is used for championships, awards, and premium moments
- Teal (#2A9D8F) is used for positive states, confirmations, and user highlights
- Masters green (#1E4D2B) is used for leaderboard headers and competition mode
- Animations: use fadeUp for list items (staggered), fadeIn for tab content

## File Structure
```
app/
  _layout.tsx              — Root layout: auth gating, ThemeProvider, AuthProvider
  (tabs)/
    _layout.tsx            — 5 tabs with Ionicons
    index.tsx              — Home screen
    score.tsx              — Score Setup screen
    trips.tsx              — Trips screen
    leaderboard.tsx        — Leaderboard screen
    profile.tsx            — Profile screen
  auth/
    splash.tsx             — Splash/landing screen
    login.tsx              — Login screen
    signup.tsx             — Sign up screen
    onboarding.tsx         — 7-step onboarding wizard
  scoring.tsx              — Live Scoring (all formats, side games)
  trip-detail.tsx          — Trip Detail (6 tabs, chat, invite codes)
  create-trip.tsx          — Create Trip wizard
  course-detail.tsx        — Course stats and leaderboard
  discover.tsx             — Dream destinations
  h2h-detail.tsx           — Head-to-head comparison
  player-detail.tsx        — Player stats and history
  season-detail.tsx        — FedEx Cup standings
  seasons.tsx              — Season creation wizard
src/
  lib/
    supabase.ts            — Supabase client (SecureStore native, AsyncStorage web)
    auth.tsx               — AuthContext provider
  theme/
    colors.ts              — Color tokens (light/dark)
    fonts.ts               — Font size and weight scales
    ThemeContext.tsx        — Theme provider with dark mode toggle
  components/
    Avatar.tsx             — 3-mode avatar (initials, themed, photo)
    CaptainsPairings.tsx   — Ryder Cup captain picks
    CoursesTab.tsx         — Course list component
    DormieMoment.tsx       — 6 cinematic moment types
    H2HTab.tsx             — H2H matchups component
    HoleTransitionBanner.tsx — Animated hole recap
    PostRoundSummary.tsx   — Stats, share card, settlement
    RecordsTab.tsx         — Records component
    RyderCupHub.tsx        — Full Ryder Cup dashboard
    RyderCupWizard.tsx     — 8-step RC wizard
    SideGameToast.tsx      — Auto/semi-auto/manual detection
    TripCountdownRing.tsx  — SVG countdown ring
  data/
    scoring.ts             — 13 formats, 16 side games, calculations
    seasons-detail.ts      — FedEx Cup computation
    trips.ts               — Trip types, invite codes
    courses.ts             — Course and tee box types
    playerDetail.ts        — Player stats types
    courseDetail.ts         — Course detail types
    h2h.ts                 — H2H types
    groups.ts              — Group types
    homeFeed.ts            — Feed item types
    leaderboard.ts         — Leaderboard types
  services/
    auth.service.ts        — Auth + profile operations
    courses.service.ts     — Course search (local + API)
    friends.service.ts     — Friend requests and search
    messages.service.ts    — Real-time chat messages
    rounds.service.ts      — Round CRUD + real-time scores
    seasons.service.ts     — Season management
    trips.service.ts       — Trip CRUD + invite codes
```

## Supabase
- URL: configured via EXPO_PUBLIC_SUPABASE_URL
- Auth: email/password with SecureStore persistence on native
- Real-time: enabled for scores and messages tables
- RPC functions: get_course_leaderboard, get_season_standings, join_trip_by_code

## Key Features
- 13 scoring formats (stroke play, match play, stableford, best ball, scramble, etc.)
- 16 side games (nassau, skins, wolf, dots, bingo bango bongo, etc.)
- Ryder Cup mode with captain picks, team pairings, and full dashboard
- Trip planning with countdown rings, invite codes, and real-time chat
- Season-long FedEx Cup-style competitions with playoffs
- Head-to-head comparisons and course-specific leaderboards
- Post-round share cards (story 9:16 + feed 1:1 aspect ratios)
- Dormie Moments: 6 cinematic celebration types
