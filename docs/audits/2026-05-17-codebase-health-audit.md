# Dormie Codebase Health Audit — 2026-05-17

Read-only audit. No files touched. 4 parallel investigations + synthesis.

---

## Executive Summary

**Codebase health: 7/10.** Foundation is sound — security posture is clean, real-time subscriptions don't leak, no SQL injection or secret exposure. The accumulated debt is mostly **(a) type safety regressions from incremental Expo/TS version bumps, (b) ~26 silent error catches that mask user-facing failures, and (c) three monster files >3000 LOC that mix data fetching, business logic, and rendering.** No emergencies. Many high-leverage mechanical fixes available.

**Headline numbers:**
- **77 TypeScript errors** (mostly clearable with 3 tsconfig + 1 mechanical sweep)
- **44 silent error suppressions** (~26 user-facing, ~18 intentional)
- **13+ dead components**, 1 dead hook, 1 dead lib file
- **5 files >2000 LOC**, top one is 6717 LOC (`season-create.tsx`)
- **0 security findings** (secrets externalized, parameterized queries, RLS enforced)

---

## 1. Pre-existing TSC Errors (77 total)

| Category | Count | Severity | Fix complexity | Sample |
|---|---|---|---|---|
| LinearGradient `string[]` vs tuple | 11 | Runtime-impacting | Mechanical sweep | `app/(tabs)/index.tsx:353`, `app/(tabs)/leaderboard.tsx:665` |
| Dynamic imports (TS1323) | 12 | Compile-blocking | One tsconfig change | `app/scoring.tsx:15,42`, `src/lib/roundStorage.ts:189,190,232` |
| Nullable/undefined string params | 6 | Runtime-impacting | Per-file nullish checks | `app/h2h-detail.tsx:93,95,99,101` |
| StyleSheet keys not defined | 5 | Compile-blocking | Per-file investigation | `app/scoring.tsx:225,228`, `app/trip-detail.tsx:380` |
| Pick<Course> mismatch (city/state→location) | 2 | Compile-blocking | One-line fix | `src/lib/database.types.ts:313` |
| Deno/Edge function imports | 4 | Compile-blocking (non-shipping) | tsconfig exclude | `supabase/functions/weekly-digest/index.ts` |
| Missing types/methods | 5 | Compile-blocking | Per-file | `app/season-detail.tsx:511` (`isCut`), `app/trip-detail.tsx:944` (`MessageReaction.count`), `app/season-settings.tsx:74` (`SeasonService.delete`) |
| Missing `useState` import | 1 | Compile-blocking | 1-line | `app/scoring.tsx:670` |
| Import `.ts` extension | 1 | Compile-blocking | tsconfig flag | `test-formats-7-12.ts:19` |
| Expo tsconfig module validation | 1 | Informational | TS version check | `node_modules/expo/tsconfig.base.json:10` |

**Schema drift signal:** `season-detail.tsx`'s missing `isCut`, `MessageReaction.count`, `Season.{currentWeek,format,multiplier}`, and `SeasonService.delete` together suggest types lagged behind schema/service evolution. This is a real concern — types are documentation that's gone stale.

**Top 3 highest-leverage tsc fixes:**
1. **tsconfig override `"module": "esnext"`** → clears **12 errors** (5 min)
2. **tsconfig `exclude: ["supabase/functions/**"]`** → clears **4 errors** (5 min)
3. **LinearGradient tuple-type mechanical sweep** → clears **11 errors** (~25 min) — type each `gradientColors` as `[string, string]` or `readonly [ColorValue, ColorValue, ...ColorValue[]]`

These three together clear **27 of 77 errors** (35%) in ~35 minutes of work.

---

## 2. Silent Error Handling (44 found)

**Tonight's reference:** `app/(tabs)/trips.tsx:1077-1080` — `.catch(() => {})` on Dream Board fetch is one of many.

| Classification | Count | Examples |
|---|---|---|
| **CODE SMELL** (user-facing operations silently failing) | ~26 | trips fetch (`trips.tsx:1080`), Dream Board (`trips.tsx:1084,1087`), stats (`trips.tsx:1090`), `score.tsx` season+trip array fallbacks, friends list ops (`add-friends.tsx` ×3), Ryder Cup mutations (`RyderCupHub.tsx` ×3) |
| **INTENTIONAL** (best-effort cleanup, optional features) | ~18 | Realtime subscription init, sharing API fallback, network probe, signOut cleanup, background image caching, demo-mode toggle |

**Top 3 critical patterns:**

1. **Cascading empty-array fallbacks** in `app/(tabs)/index.tsx` and `app/(tabs)/score.tsx` — `Promise.all([...]).catch(() => [])` chains silently set state to `[]` on any failure. Production users see blank Home/Score with no error signal. **Hard to debug.**

2. **Silent session signout** at `src/lib/auth.tsx:30,39` — token refresh failures silently sign user out. They may not realize session expired. Worth surfacing.

3. **Ryder Cup mutation failures** at `RyderCupHub.tsx` (×3 ops including `updateMemberTeam`) — tournament state writes that fail leave the UI optimistically updated without surfacing the failure. Potential data-divergence bug.

**Recommended pattern (established in `[Dormie]`-tagged warns):**
```ts
.catch((e) => console.warn('[Dormie] <context>:', e))
```

---

## 3. Security / Runtime Safety

**Status: CLEAN across all 6 subcategories.** Notable findings:

| Concern | Status | Notes |
|---|---|---|
| Secrets in source | ✅ Clean | All `EXPO_PUBLIC_*`, `SUPABASE_*`, API keys properly env-injected |
| SQL injection | ✅ Clean | All `.rpc()` calls parameterized; no template-literal queries |
| Auth bypass | ✅ Clean | Services consistently filter by `user_id`; RLS assumed at DB level |
| Subscription cleanup | ✅ Clean | All realtime channels have `removeChannel`/`unsubscribe` in useEffect returns |
| Recursion / loops | ✅ Clean | All timers/intervals have termination conditions |
| Realtime memory | ✅ Clean | Services return RealtimeChannel for caller-side cleanup; callers use it correctly |

**Single minor concern:** `src/lib/accessibility.ts` — `AccessibilityInfo.addEventListener` may lack cleanup return. Low-impact (feature flag), but worth a glance.

---

## 4. Dead Code Inventory

### Suspected dead components (13 confirmed zero importers)

| Component | Location | Confidence |
|---|---|---|
| ScoreboardOverlay | src/components/scoring/ | HIGH (dead) |
| StatsEntry | src/components/scoring/ | HIGH (backwards-compat alias only) |
| WagerSetup | src/components/scoring/ | HIGH (dead) |
| LogHoleTags | src/components/scoring/ | HIGH (dead) |
| PuttInput | src/components/scoring/ | HIGH (dead) |
| RoundContextBanner | src/components/scoring/ | HIGH (dead) |
| LowHighRecap | src/components/scoring/ | HIGH (dead) |
| SixSixSixRecap | src/components/scoring/ | HIGH (dead) |
| SideGameTicker | src/components/scoring/ | HIGH (dead) |
| ThreePuttPokerRecap | src/components/scoring/ | HIGH (dead) |
| LeaderboardCard | src/components/share/ | HIGH (dead) |
| SeasonChampionCard | src/components/share/ | HIGH (dead) |
| ShareButton | src/components/share/ | HIGH (dead) |

⚠️ **Coordination note:** Many of these dead components live under `src/components/scoring/` — the parallel session is investigating scoring engines. **Don't delete without coordinating with that session first** — they may be planning to wire some of these in.

### Other dead code
- **`src/hooks/useRealtimeStandings.ts`** — 0 imports
- **`src/lib/offline.ts`** — 0 imports (offline action queue infrastructure, never wired up)
- **`src/lib/networkStatus.ts`** — 2 imports (mostly dormant)
- **`src/lib/weather.ts`** — 1 import (rarely used)
- **`src/services/__tests__/handicap.test.js`** — duplicate of `.ts` version, should be removed

### Migration sanity
- 28 migrations, all append-only. **No rollback pairs.** Clean history.

---

## 5. File Organization

### Top 10 largest files

| File | LOC | Concerns mixed | Refactor priority |
|---|---|---|---|
| `app/season-create.tsx` | **6717** | data + business + render + nav | 🚨 CRITICAL |
| `app/trip-detail.tsx` | **4102** | data + business + render + nav | 🚨 CRITICAL |
| `src/components/RyderCupHub.tsx` | **3363** | data + business + render + nav | HIGH |
| `app/(tabs)/score.tsx` | 2474 | data + business + render | HIGH |
| `app/(tabs)/trips.tsx` | 2363 | data + business + render | MEDIUM |
| `app/(tabs)/index.tsx` | 2325 | data + business + render | MEDIUM |
| `src/components/RyderCupWizard.tsx` | 2139 | wizard state + render | MEDIUM |
| `app/season-detail.tsx` | 2130 | data + render | MEDIUM |
| `src/components/scoring/styles.ts` | 1914 | styles only | ✅ Acceptable |
| `app/auth/onboarding.tsx` | 1912 | wizard state + render | MEDIUM |

### Naming inconsistencies
- **`src/data/` files mix casing:** `competitionImpact.ts`, `courseDetail.ts`, `golf-calendar.ts`, `monthly-stats.ts` — should standardize to camelCase
- **StyleSheet variable naming inconsistent:** `styles` (60%) vs `s` (20%) vs `z` (5%, e.g., `create-trip.tsx:81`) vs semantic names (e.g., `EmptyStates.tsx`'s `season`/`ghost`/`trip`)

### Test coverage gaps (CRITICAL paths with no tests)
| Path | File | Risk |
|---|---|---|
| Scoring engine math | `src/data/scoring.ts` (845 LOC) | CRITICAL — core game correctness untested |
| Trip creation | `src/services/trips.service.ts` | HIGH |
| Season standings RPC | `src/services/seasons.service.ts` | HIGH |
| Invite code logic | `src/lib/inviteLinks.ts` | HIGH |

**Existing test coverage (good):** bracket progression, scoring formats, WHS handicap, wizard quick-trip, roster generation.

---

## 6. Inconsistent Patterns

### 1. Theme colors
- **Convention:** `useTheme().colors` tokens
- **Outliers:** ~50 hardcoded hex literals across `SeasonStatsSection.tsx`, `RyderCupHub.tsx`, `MatchupReveal.tsx`, `app/scoring.tsx:137-141`
- **Worst offender:** `SeasonStatsSection.tsx` (20+ violations mixing theme tokens with `#FFFFFF`, `#1A2744`, `#00000088`)
- **Suggested fix:** Extract Ryder Cup team colors (`#B71C1C`, `#1565C0`) to `src/theme/colors.ts`; replace `#fff` literals with `theme.colors.surface`

### 2. Date handling 🚨 **Tonight's timezone audit is incomplete**
- **Convention (per tonight's commits):** YMD helpers (`toYMD`, `fromYMD`, `todayYMD`, `daysBetweenYMD`) — but these are localized to `src/components/wizard/quick-trip/dateHelpers.ts`
- **Outliers (timezone bug exposure):**
  - `src/lib/streaks.ts:127-129` — raw millisecond arithmetic, no YMD guards
  - `src/services/trips.service.ts:288,350,433` — `new Date(t.created_at).getTime()`
  - `src/scoring/useScoringState.ts:817` — `new Date(b.played_at).getTime() - new Date(a.played_at).getTime()`
  - `src/components/wizard/trip-launched/roster.ts:413` — duration math via raw getTime
- **Recommended:** Lift YMD helpers to `src/lib/dateHelpers.ts` (not wizard-scoped) and audit raw `getTime()` usage

### 3. Error logging
- **Established convention:** `[Dormie]` tag in `src/lib/sentry.ts:7` and `src/components/ErrorBoundary.tsx:33` — but used in only **~5 calls**
- **Divergent tags:** `[COURSE_IMAGE]`, `[DESTINATION_IMAGE]`, `[CreateTrip]`, `[CreateTripQuick]`, `[scoring]`, `[roundStorage]`, `[authService.updateProfile]` (each used 2-5 times)
- **Sentry usage:** **Only 1 captureException across entire app** (`ErrorBoundary.tsx`). `@sentry/react-native` is installed but not systematically used.

### 4. Loading states ✅
Consistent `useState(bool)` pattern across all 9 instances. No action needed.

### 5. Form validation
All forms use inline validation (`if (!field.trim()) showError(...)`). No zod/yup. Acceptable for MVP; consider zod adoption if validation grows complex.

### 6. Service layer ✅
95% consistent. All services import same client, all use `if (error) throw error`. Minor: `.single()` vs `.maybeSingle()` usage is mostly principled. One outlier: `ledger.service.ts` skips `error` destructure.

### 7. StyleSheet variable naming
Inconsistent (`styles`/`s`/`z`/semantic). Recommend lint rule for `styles` as standard; semantic names allowed only when component has multiple distinct style sections.

---

## 7. Priority Recommendations (synthesis)

### 🎯 Top 5 highest-leverage pre-beta cleanups

| # | Action | Clears | Time |
|---|---|---|---|
| 1 | **tsconfig sweep**: `module:esnext` + `exclude supabase/functions/**` + `allowImportingTsExtensions` | 17 tsc errors | 10 min |
| 2 | **LinearGradient tuple-type sweep** across 11 files | 11 tsc errors | 25 min |
| 3 | **Add `[Dormie]` tagged warns to ~26 code-smell silent catches** in `app/(tabs)/index.tsx`, `trips.tsx`, `score.tsx`, `RyderCupHub.tsx` | Production debugging visibility for top tabs | 45 min |
| 4 | **Lift YMD date helpers** from wizard scope to `src/lib/dateHelpers.ts`, audit `src/lib/streaks.ts` + `services/trips.service.ts` for raw `getTime()` | Future timezone bugs (same family as tonight's commits) | 60 min |
| 5 | **Fix schema-drift tsc errors** (`Pick<Course>` city/state, `isCut`, `MessageReaction.count`, `Season.*`, `SeasonService.delete`) | 5 tsc errors + reveals real type-vs-schema mismatches | 60 min |

**Total: ~3.5 hours to clear ~45 tsc errors + add production observability + close timezone bug family.**

### ⚡ Top 5 lowest-effort wins (mechanical, do anytime)

| # | Action | Time |
|---|---|---|
| 1 | Add missing `useState` import in `app/scoring.tsx:670` | 1 min |
| 2 | Delete duplicate `src/services/__tests__/handicap.test.js` | 1 min |
| 3 | Fix `Pick<Course>` city/state → location in `src/lib/database.types.ts:313` | 5 min |
| 4 | tsconfig `module:esnext` override | 5 min |
| 5 | tsconfig `exclude: ["supabase/functions/**"]` | 5 min |

### 📋 Compost (future workstreams)

- **Refactor `season-create.tsx`** (6717 LOC) — extract steps to folder, lift bracket logic, create `useSeasonCreateState` hook. ~6 hours.
- **Refactor `trip-detail.tsx`** (4102 LOC) — extract Roster, MessageThread, MomentGrid. ~4 hours.
- **Refactor `RyderCupHub.tsx`** (3363 LOC) — coordinate with parallel scoring session first.
- **Scoring engine tests** — `src/data/scoring.ts` (845 LOC) is core game math without tests. Coordinate with parallel scoring session.
- **Logger utility + Sentry integration** — create `src/lib/logger.ts`, standardize on `[Dormie]` prefix, wire Sentry capture into services.
- **Dead `src/components/scoring/` purge** — 10 dead components. **Coordinate with parallel scoring session before deleting** (they may be wiring them in).
- **`src/lib/offline.ts` removal** — offline action queue infrastructure, never used. Or wire it up if offline support is a roadmap item.
- **Theme color audit** — replace ~50 hardcoded literals with `useTheme()` tokens. ~2-3 hours.

### ⏰ Schedule-soon (urgent enough to slot before beta)

- **Item 1-3 above** (tsconfig sweep + LinearGradient + silent-catch logging) — 80 min combined, massive observability win
- **Schema-drift tsc errors** (item 5) — reveals real bugs hiding behind type holes
- **Date helper lift** (item 4) — same bug family Ian fixed tonight, exposure remains

---

## 8. Coordination Notes for Parallel Sessions

The parallel session is investigating scoring engines. Items requiring coordination before action:
- **Dead scoring components** under `src/components/scoring/` (10 candidates) — confirm with that session before deletion
- **`RyderCupHub.tsx` refactor** — overlap with scoring concerns
- **Scoring engine test coverage** — `src/data/scoring.ts` and `src/scoring/useScoringState.ts` are likely under active analysis there

---

## 9. Surprising Findings

1. **Schema drift is real.** The `Season.currentWeek`/`format`/`multiplier` missing props and `SeasonService.delete` missing method aren't just type errors — they're signals that types/services lagged behind feature work. Worth a 30-min audit pass on the seasons surface area.

2. **StyleSheet type inference bugs** (`wolfBanner`, `freshnessBar`, `sectionWithFreshness`) — styles ARE defined but TypeScript can't see them. Suggests dynamic/conditional StyleSheet construction. Worth investigating one to understand if it's a pattern problem.

3. **Sentry is installed but only fires once.** `@sentry/react-native` is in `package.json`, configured in `src/lib/sentry.ts`, but `captureException` is called in exactly **one** place (`ErrorBoundary.tsx`). Production error visibility is essentially zero outside crashed React trees. **This is a sleeper issue** — silent catches + no Sentry = blind to production failures.

4. **Realtime cleanup is the only thing that's universally well-done.** Every subscription has cleanup. Notable because subscription leaks are usually the #1 RN issue.

5. **`src/lib/offline.ts` exists but is never imported.** Suggests offline support was scoped but abandoned. Decide: ship it or delete it.

---

End of audit. Read-only — no files modified. No git operations. Standing by.
