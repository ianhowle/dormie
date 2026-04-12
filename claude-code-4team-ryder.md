# CLAUDE CODE: Implement 4-Team Ryder Cup Season Type

Implement 4-Team Ryder Cup as a new season type. Extends standard Ryder Cup to 4 teams in round-robin format. Commit when complete.

## GAME OVERVIEW

4-Team Ryder Cup is a multi-round tournament:
- 4 teams compete against each other (round-robin)
- 6 total matchups: A-B, A-C, A-D, B-C, B-D, C-D
- Uses Ryder Cup formats: Four-Ball, Foursomes, Singles, Shamble
- Points accumulate across all matches
- Team with most points wins

## SCHEDULE

3-Round format:
- Round 1: A vs B, C vs D
- Round 2: A vs C, B vs D
- Round 3: A vs D, B vs C

Single-round format (18 holes split):
- Holes 1-6: A vs B, C vs D
- Holes 7-12: A vs C, B vs D
- Holes 13-18: A vs D, B vs C

## STATE STRUCTURE

```typescript
interface FourTeamRyderCupConfig {
  teams: {
    id: string;
    name: string;
    color: string;
    captainId?: string;
    playerIds: string[];
  }[];
  schedule: {
    roundIdx: number;
    matches: {
      matchId: string;
      team1Id: string;
      team2Id: string;
      format: 'four_ball' | 'foursomes' | 'singles' | 'shamble';
    }[];
  }[];
  results: {
    [matchId: string]: {
      team1Points: number;
      team2Points: number;
      holeResults: { [holeIdx: number]: { winner: string; } };
      status: 'pending' | 'in_progress' | 'complete';
      matchWinner: 'team1' | 'team2' | 'halved' | null;
    }
  };
  standings: TeamStanding[];
}

interface TeamStanding {
  teamId: string;
  totalPoints: number;
  matchesWon: number;
  matchesLost: number;
  matchesHalved: number;
}
```

## FORMAT SCORING

- Four-Ball: Each player plays own ball, team score = lower of two
- Foursomes: Partners share one ball, alternate shots
- Singles: 1v1 individual match play
- Shamble: Best drive, then own ball from there

Match result: Team winning more holes gets 1 point. Tie = 0.5 each.

## UI COMPONENTS

1. Setup Wizard: Create 4 teams (name, color), assign players, set schedule
2. Dashboard/Hub: Standings, current matches, upcoming schedule
3. Match Scoring: Hole-by-hole with team colors, running status
4. Bracket View: Visual of all matchups with results

## CINEMATIC MOMENTS

1. CUP_CLINCHED: 🏆 "[TEAM NAME]/WINS THE CUP" - "Champions."
2. MATCH_CLOSED: 🤝 "MATCH/CLOSED" - Shows margin (e.g., "5&3")

## FILES TO CREATE

- src/components/seasons/FourTeamRyderHub.tsx
- src/components/seasons/FourTeamRyderSetup.tsx
- src/components/seasons/FourTeamRyderStandings.tsx
- src/components/seasons/FourTeamRyderMatch.tsx
- src/services/fourTeamRyder.service.ts

## FILES TO MODIFY

- src/services/seasons.service.ts — Add 'four_team_ryder' type
- app/season-create.tsx — Add wizard flow
- app/season-detail.tsx — Route to FourTeamRyderHub
- src/components/DormieMoment.tsx — Add CUP_CLINCHED moment
