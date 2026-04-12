# CLAUDE CODE: Implement SixSixSix (6-6-6) Scoring Format

Implement SixSixSix as a new scoring format. This is a 4-player team game where partners ROTATE every 6 holes, so everyone plays with everyone. Commit when complete.

## GAME OVERVIEW

SixSixSix divides 18 holes into three 6-hole segments with rotating partners:
- Holes 1-6: Player A + B vs Player C + D
- Holes 7-12: Player A + C vs Player B + D
- Holes 13-18: Player A + D vs Player B + C

Each segment is a separate match. Players earn "dots" for holes their team wins.

## STATE STRUCTURE

```typescript
interface SixSixSixState {
  players: string[];  // Exactly 4 player IDs [A, B, C, D]
  scoringMethod: 'low_ball' | 'combined' | 'match_play';
  segments: {
    [segmentIdx: number]: {
      team1: [string, string];
      team2: [string, string];
      holeResults: { [holeIdx: number]: 'team1' | 'team2' | 'halved' };
      team1Wins: number;
      team2Wins: number;
      winner: 'team1' | 'team2' | 'halved' | null;
    }
  };
  dots: { [playerId: string]: number };
}
```

## PARTNERSHIP ROTATION

```typescript
function getPartnerships(players, holeIdx) {
  const [A, B, C, D] = players;
  if (holeIdx < 6) return { team1: [A, B], team2: [C, D] };
  if (holeIdx < 12) return { team1: [A, C], team2: [B, D] };
  return { team1: [A, D], team2: [B, C] };
}
```

## SCORING METHODS

1. Low Ball (default): Team score = best of two partners
2. Combined: Team score = sum of both partners
3. Match Play: Compare all 4 scores for low/high points

## DOTS SYSTEM

When team wins a hole, BOTH players on that team earn 1 dot. Track individually across all 18 holes.

## UI COMPONENTS

- Round Setup: Requires exactly 4 players, player order picker, scoring method selector
- Per-Hole Banner: Show current partnerships and segment score
- Segment Transition: After holes 6 and 12, show "PARTNERS ROTATE" with new pairings
- Settlement: Show segment results and individual dot totals

## FILES TO MODIFY

- src/data/scoring.ts — Add 'sixsixsix' format
- src/scoring/useScoringState.ts — Add sixSixSixState
- Create src/components/scoring/SixSixSixBanner.tsx
- Create src/components/scoring/SixSixSixRecap.tsx
- Update app/scoring.tsx for segment transitions
