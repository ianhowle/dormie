# Seasons Feature Audit — 2026-04-19

Auditor: Claude  
Scope: Season creation, standings math, score write path, playoff cuts, bracket separation, detail screen, digest integration, completion flow

---

## 1. Season Creation Wizard (`app/season-create.tsx`)

### Season Types & DB Type Mapping

The wizard offers 7 season types:
- FedEx Cup, Ryder Cup, 4-Team Ryder, Match Play Bracket, Stroke Play Series, League, Custom

The DB schema (`006_seasons.sql:9`) constrains `type` to only 3 values: `'fedex' | 'ryder' | 'custom'`.

The wizard maps at line 5923-5929:
- `bracket`, `stroke_series`, `league` → stored as `'custom'` with `config.season_subtype` preserving the real type
- `four_team_ryder` → **not mapped** — falls through to the `as 'fedex' | 'ryder' | 'custom'` cast, which passes `'four_team_ryder'` verbatim

🔴 **CRITICAL — `four_team_ryder` violates DB CHECK constraint**  
`season-create.tsx:5923-5926` maps `bracket`, `stroke_series`, `league` to `'custom'` but `four_team_ryder` is not in the mapping. It passes through as-is, which will fail the `CHECK (type IN ('fedex','ryder','custom'))` constraint on insert. Season creation will silently fall back to AsyncStorage (line 6063-6066 catches and continues), giving the user a local-only season with no indication it failed.

🟡 **WARNING — `four_team_ryder` reuses 2-team Ryder Cup steps**  
Line 186: `case 'four_team_ryder': return RYDER_STEPS` — the wizard steps are designed for 2-team (Red vs Blue) Ryder Cup. No UI exists for configuring 4 separate teams, round-robin scheduling, or 6-matchup structure. The "4-Team Ryder" option is a UI stub with no distinct wizard flow.

### Submission Flow

✅ **PASS — Supabase creation flow is correct**  
`seasonsService.create()` (line 19-47): Inserts season, bulk-inserts weeks, bulk-inserts members with de-duplication (`new Set`). Creator is always included in members.

🟡 **WARNING — AsyncStorage fallback has no sync-back mechanism**  
Lines 6069-6097: If Supabase insert fails, the season is saved to AsyncStorage with `_local_weeks` and `_local_member_ids` in the config blob. No code path exists to later sync these to Supabase. Local-only seasons will be invisible to other group members.

### Template System

✅ **PASS** — Template save/load via AsyncStorage (lines 5588-5679) correctly preserves and restores all custom config state.

---

## 2. Season Week Progression

🔴 **CRITICAL — Missing DB columns for week state tracking**  
The `season_weeks` table (migration `006_seasons.sql:33-47`) does NOT contain `completed`, `all_scores_submitted`, or `due_date` columns. However:
- `season-detail.tsx:1450-1452` writes `{ completed: true, all_scores_submitted: true }` to `season_weeks`
- `digest.service.ts:130-131` queries `.gte('due_date', ...)` on `season_weeks`
- `season-detail.tsx:1195` reads `w.completed` and `w.all_scores_submitted`

These columns do not exist in any migration (confirmed grep across all 18 migration files). The update/query operations will silently succeed on Supabase (JSONB-style columns are ignored) but the values will never persist — **weeks can never be marked complete in the database**.

🟡 **WARNING — Multiplier applied destructively during advance**  
`season-detail.tsx:1437-1447`: When advancing a week with `multiplier > 1`, the code reads existing `season_scores.points` and overwrites with `points * multiplier`. If `refreshData()` is called before the next advance, or if advance runs twice (e.g., double-tap), points are multiplied again. There is no idempotency guard.

⚪ **NOTE — No automatic week advancement**  
Week progression is entirely manual via the commissioner's "Advance Week" button. There is no cron, no date-based auto-advance, and no push notification to remind the commissioner. Acceptable for MVP but may cause stalled seasons.

---

## 3. Standings Math — Cumulative Point Calculation

### Previous Bug: 25+16+20=61 displaying 72

✅ **PASS (demo data) — Math is now correct**  
`DEMO_STANDINGS` (line 93): McGowan has `weekResults: [25, 16, 20, 12]` and `points: 73`. Sum: 25+16+20+12 = 73. The previously reported discrepancy (61 vs 72) is not reproducible in the current demo data.

### Real Data Path — `getStandingsWithCounting()`

🟡 **WARNING — `bestFinish` is never computed**  
`seasons.service.ts:129,178`: `bestFinish` initializes to 999 but is never updated from week-level position data. Line 178 falls through to `bestFinish < 999 ? bestFinish : 1`, so every player's best finish displays as `1`. The RPC `get_season_standings` correctly computes best finish via subquery, but `getStandingsWithCounting()` is called first (line 1154) and used preferentially.

### Real Data Path — RPC `get_season_standings`

🟡 **WARNING — RPC sums ALL scores, ignoring `is_counting`**  
`007_rpc_functions.sql:79-95`: `SUM(ss.points)` aggregates every `season_scores` row with no `WHERE ss.is_counting = true` filter. In multi-round weeks where only the best round should count, the RPC will double-count non-counting rounds. The client-side fallback `getStandingsWithCounting` does filter by `is_counting`, but that column may not exist (see Section 4).

### Real Data Path — `week_results` array

🟡 **WARNING — `week_results` not returned by either standings method**  
`season-detail.tsx:1177` reads `s.week_results ?? []` but neither `getStandingsWithCounting()` nor the `get_season_standings` RPC returns a `week_results` field. The standings table's per-week columns will always show empty.

---

## 4. Score Submission — Rounds to `season_scores`

🔴 **CRITICAL — Missing columns on `season_scores` table**  
The `season_scores` table (migration `006_seasons.sql:52-60`) has these columns:
```
id, season_week_id, user_id, round_id, points
UNIQUE(season_week_id, user_id)
```

The code writes to columns that do not exist in any migration:
- `is_counting` (boolean) — written at `scoring.service.ts:95,149`
- `participation_bonus` (decimal) — written at `scoring.service.ts:150`

These writes will fail silently or error depending on Supabase configuration.

🔴 **CRITICAL — Unique constraint mismatch blocks multi-round weeks**  
The DB unique constraint is `UNIQUE(season_week_id, user_id)` (line 59), but the upsert at `scoring.service.ts:97` specifies `onConflict: 'season_week_id,user_id,round_id'`. This 3-column conflict target does not match the 2-column unique constraint. Result:
- First round in a week: inserts fine
- Second round in same week: violates `UNIQUE(season_week_id, user_id)` and fails, since the conflict resolution targets a non-existent 3-column unique index

Multi-round weeks are fundamentally broken at the DB level.

🔴 **CRITICAL — Missing `season_week_side_games` table**  
`seasons.service.ts:208-268` queries and writes to a `season_week_side_games` table. No migration creates this table. All side game operations will throw.

🟡 **WARNING — Missing `eliminated` column on `season_members`**  
`season-detail.tsx:1162-1167` queries `season_members.eliminated = true` and line 1473-1477 updates it. The `006_seasons.sql` migration defines `season_members` with only `id, season_id, user_id, team`. No `eliminated` boolean column exists.

---

## 5. FedEx Cup Playoff Cuts

🟡 **WARNING — No progressive cuts (Top 70 → 50 → 30) implemented**  
The real PGA FedEx Cup uses progressive cuts across playoff rounds. This implementation has:
- A single cut at the regular-season → playoff boundary (line 1466-1478)
- `getPlayoffCutLine()` in `seasons-detail.ts:264-269` supports configurable percentages (25/33/50/67/75%)
- But only one cut is ever applied — the cut between regular season and playoffs

No code exists to apply additional cuts between playoff rounds or to implement Tour Championship starting strokes. The `PlayoffBracket` component (line 718) hardcodes a 4-player bracket regardless of field size.

🟡 **WARNING — Cut percentage coercion is lossy**  
`season-detail.tsx:1467-1468`: `Math.round(fedexConfig.cut_percentage * 100) as 25 | 33 | 50 | 67 | 75` — if the config stores `0.67`, this correctly becomes `67`. But if stored as `0.5`, it becomes `50`. The `as` cast is unsafe if the config holds any non-standard value (e.g., `0.60` → `60` which is not in the union type). The function accepts it at runtime since it's just a number, but the type assertion is misleading.

✅ **PASS — Cut line display works correctly**  
The standings table correctly shows "PROJECTED CUT" line and "ELIMINATED" labels with visual dimming.

---

## 6. Match Play Bracket — Wizard Separation

✅ **PASS — Bracket has its own wizard flow**  
`BRACKET_STEPS` (separate from `FEDEX_STEPS`) provides: basics → bracket_setup → bracket_rules → bracket_members → bracket_review. The bracket creation generates seeded matches via `generateBracketMatches()` and stores them in `config.bracket_matches`.

🟡 **WARNING — Bracket matches stored only in config JSONB**  
Bracket match state (player scores, advancement, completion) is stored in the `config` JSONB blob on the seasons table and/or AsyncStorage. There are no dedicated bracket tables. For a 32-player bracket with 31 matches, this JSONB blob grows large. More importantly, concurrent score submissions could cause lost updates since the entire matches array is read-modify-written.

⚪ **NOTE — Double elimination declared but not implemented**  
`BracketFormat` type includes `'double'` (line 8 of `seasons-detail.ts`), and `BracketMatch` has an `is_losers_bracket` field (line 40), but no code generates losers bracket matches or handles double-elimination logic. The wizard allows selecting "double elimination" but the bracket will behave as single elimination.

---

## 7. Season Detail Screen (`app/season-detail.tsx`)

### View Rendering by Season Type

✅ **PASS — Type routing works**  
`applyConfig()` (lines 1242-1259) correctly detects season type from `config.season_type` or `config.season_subtype` and sets the appropriate state flags (`isStrokePlay`, `isLeague`, `isRyderCup`, `isBracket`). Each type renders its own component (StrokePlayStandings, LeagueStandings, RyderCupHub, BracketView).

🟡 **WARNING — FedEx config always set regardless of type**  
Line 1259: `setFedexConfig(config)` runs for ALL season types (it's outside the if/else chain). This means `fedexConfig.cut_percentage` (line 1408) is read even for League or Stroke Play seasons that shouldn't have a playoff cut. If their config doesn't have `cut_percentage`, it falls back to `CUT_PERCENTAGE = 0.67` (line 145), which may cause an unexpected cut line to appear.

🟡 **WARNING — Playoff bracket determines winner by cumulative points, not playoff match**  
Lines 800-802: Semi-final and final winners are determined by `p.points >= q.points` — this compares season-long cumulative points, not playoff-round performance. The higher-seeded player always wins since they have more cumulative points. This makes the playoff bracket deterministic and non-competitive.

### Career Stats Modal

🟡 **WARNING — Championships always show 0**  
`seasonStats.service.ts` `getCareerStats()`: Returns `championships: 0` with a comment "would need full standings computation." The career stats modal in season-detail shows this field but it will always be zero.

---

## 8. Weekly Digest Integration

✅ **PASS — Digest fetches season standings via RPC**  
`digest.service.ts:50-68`: `buildStandings()` correctly queries `season_members` joined to `seasons`, then calls `get_season_standings` RPC for each season. Maps user position and leader name into `DigestStandingRow`.

🔴 **CRITICAL — Digest queries non-existent `due_date` column**  
`digest.service.ts:128-132`: `buildDeadlines()` queries `season_weeks.due_date` with range filters. This column does not exist in the `season_weeks` migration. The query will return empty results — **the "Upcoming Deadlines" section of the Sunday digest will always be empty**.

⚪ **NOTE — Digest fetches `season_weeks.season` join**  
Line 128: `.select('season_id, week_number, due_date, format, season:seasons(name)')` — this join works but could be simplified since `season_id` is already available from the membership query.

---

## 9. Season Completion / Winner Declaration

✅ **PASS — FedEx completion flow**  
When the championship week is advanced (`currentWeekData.isChampionship` at line 1457), the season status is updated to `'completed'` and `ChampionCeremony` modal fires.

✅ **PASS — Bracket completion flow**  
`handleLogBracketScore` (line 1319-1372): When the final bracket match resolves, `isBracketComplete` triggers champion detection, persists to AsyncStorage, sets status to `'completed'`, and shows `DormieMoment` cinematic.

✅ **PASS — Stroke Play & League completion**  
Both `StrokePlayStandings` and `LeagueStandings` components accept `onChampionMoment` callbacks that trigger `DormieMoment` overlays.

🟡 **WARNING — No completion for Ryder Cup seasons**  
`season-detail.tsx` sets `isRyderCup = true` and renders `RyderCupHub`, but no completion/champion detection logic exists for Ryder Cup season type. The Ryder Cup's winner is determined internally by `RyderCupHub` but the season status is never updated to `'completed'`.

🟡 **WARNING — Champion ceremony uses demo standings for FedEx**  
`ChampionCeremony` receives `standings` prop which comes from `realStandings` state. If the DB load failed and demo data is showing, the champion ceremony would declare the demo player ("McGowan") as the winner.

---

## Summary Table

| Area | Finding | Severity |
|------|---------|----------|
| `four_team_ryder` DB insert | Violates CHECK constraint, silently falls to local storage | 🔴 CRITICAL |
| `season_weeks` missing `completed`/`all_scores_submitted`/`due_date` | Week state never persists to DB | 🔴 CRITICAL |
| `season_scores` missing `is_counting`/`participation_bonus` | Score counting logic writes to non-existent columns | 🔴 CRITICAL |
| `season_scores` unique constraint vs upsert conflict | Multi-round weeks fail on 2nd round insert | 🔴 CRITICAL |
| `season_week_side_games` table missing | All side game operations throw | 🔴 CRITICAL |
| `season_members` missing `eliminated` column | Playoff elimination cannot persist | 🔴 CRITICAL |
| Digest `due_date` query on non-existent column | Sunday digest deadlines always empty | 🔴 CRITICAL |
| Multiplier applied destructively (non-idempotent) | Double advance doubles points again | 🟡 WARNING |
| `bestFinish` never computed in client standings | Always displays 1 for every player | 🟡 WARNING |
| RPC sums all scores, ignores `is_counting` | Multi-round weeks double-counted in RPC | 🟡 WARNING |
| `week_results` not returned by standings | Per-week columns in table always empty | 🟡 WARNING |
| No progressive playoff cuts | Single cut only, no Top 70→50→30 | 🟡 WARNING |
| Playoff bracket winner by cumulative pts | Higher seed always wins — bracket is decorative | 🟡 WARNING |
| Ryder Cup season never completes | Status stuck on 'active' | 🟡 WARNING |
| No `four_team_ryder` unique wizard flow | Uses 2-team Ryder steps | 🟡 WARNING |
| Bracket config stored in JSONB blob | Concurrent writes can lose updates | 🟡 WARNING |
| Championships always 0 in career stats | Incomplete aggregation | 🟡 WARNING |
| AsyncStorage fallback has no sync-back | Local seasons invisible to other members | 🟡 WARNING |
| Double elimination not implemented | Type exists, logic doesn't | ⚪ NOTE |
| No auto week advancement | Commissioner must manually advance | ⚪ NOTE |

---

## Top 3 Priorities

### 1. Add Missing Migration for Season Columns and Tables
**Impact**: 7 of the 8 critical findings stem from schema gaps.  
Create a new migration adding:
- `is_counting BOOLEAN DEFAULT true` and `participation_bonus DECIMAL(6,1) DEFAULT 0` to `season_scores`
- Alter unique constraint on `season_scores` from `(season_week_id, user_id)` to `(season_week_id, user_id, round_id)` to support multi-round weeks
- `completed BOOLEAN DEFAULT false`, `all_scores_submitted BOOLEAN DEFAULT false`, `due_date DATE` to `season_weeks`
- `eliminated BOOLEAN DEFAULT false` to `season_members`
- Create `season_week_side_games` table with RLS policies
- This single migration unblocks the entire score write path, week progression, playoff elimination, digest deadlines, and side games.

### 2. Fix `four_team_ryder` DB Type Mapping
**Impact**: Selecting "4-Team Ryder" in the wizard causes a silent Supabase failure.  
Add `four_team_ryder` to the `dbType` mapping alongside `bracket`/`stroke_series`/`league` → `'custom'` with `config.season_subtype = 'four_team_ryder'`. Longer term, build a distinct 4-team wizard flow.

### 3. Fix Playoff Bracket to Use Playoff-Round Scores
**Impact**: The FedEx playoff bracket currently compares cumulative season points, making outcomes predetermined before playoffs begin.  
Playoff matchups should compare only the scores from the specific playoff week, not cumulative totals. This requires the playoff bracket to read per-week scores rather than total `p.points`.
