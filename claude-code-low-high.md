# CLAUDE CODE: Implement Low Ball / High Ball Scoring Format

Implement Low Ball / High Ball as a new scoring format. This is a 4-player 2v2 team game where BOTH partners' scores matter — teams compete for both the best low score AND the best high score on each hole. Commit when complete.

## GAME OVERVIEW

Low Ball / High Ball awards two points per hole:
- LOW BALL POINT: Team with the lower of the two "best" scores wins
- HIGH BALL POINT: Team with the lower of the two "worst" scores wins

This keeps high-handicap players engaged because their score still competes.

## STATE STRUCTURE

```typescript
interface LowHighState {
  teams: {
    team1: [string, string];
    team2: [string, string];
  };
  tieHandling: 'halve' | 'carryover' | 'no_point';
  birdieBonus: boolean;
  includeTotal: boolean;
  holeResults: {
    [holeIdx: number]: {
      lowBallWinner: 'team1' | 'team2' | 'halved';
      highBallWinner: 'team1' | 'team2' | 'halved';
      totalWinner?: 'team1' | 'team2' | 'halved';
    }
  };
  points: { team1: number; team2: number; };
}
```

## SCORING LOGIC

```typescript
function scoreLowHighHole(players, holeIdx, state, par) {
  const getScore = (id) => players.find(p => p.id === id)?.scores[holeIdx];
  
  const t1Scores = state.teams.team1.map(getScore).filter(Boolean);
  const t2Scores = state.teams.team2.map(getScore).filter(Boolean);
  
  const t1Low = Math.min(...t1Scores);
  const t2Low = Math.min(...t2Scores);
  const t1High = Math.max(...t1Scores);
  const t2High = Math.max(...t2Scores);
  
  const lowWinner = t1Low < t2Low ? 'team1' : t2Low < t1Low ? 'team2' : 'halved';
  const highWinner = t1High < t2High ? 'team1' : t2High < t1High ? 'team2' : 'halved';
  
  return { lowWinner, highWinner };
}
```

## VARIANTS

1. Standard: 2 points per hole (36 total)
2. High-Low-Total: 3 points per hole (adds combined score)
3. Birdie Bonus: Low ball won with birdie = 2 points

## UI COMPONENTS

- Round Setup: Team picker (drag players into teams), toggle options
- Per-Hole Display: Show low/high winners with team indicators
- Settlement Recap: Final points, breakdown by category

## CINEMATIC MOMENT — CLEAN SWEEP

Trigger when same team wins BOTH low and high on one hole:
- Emoji: 🧹
- Title: "CLEAN" / "SWEEP"
- Tagline: "Top to bottom."
- Background: Gold gradient

## FILES TO MODIFY

- src/data/scoring.ts — Add 'low_high' format
- src/scoring/useScoringState.ts — Add lowHighState
- Create src/components/scoring/LowHighBanner.tsx
- Create src/components/scoring/LowHighRecap.tsx
- src/components/DormieMoment.tsx — Add CLEAN_SWEEP moment
- Update round setup for team picker UI
