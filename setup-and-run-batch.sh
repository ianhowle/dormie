#!/bin/bash

echo "📝 Creating spec files..."

# ═══════════════════════════════════════════════════════════════
# SPEC 1: LOW BALL / HIGH BALL
# ═══════════════════════════════════════════════════════════════
cat > claude-code-low-high.md << 'SPEC1'
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
SPEC1

echo "✅ Created claude-code-low-high.md"

# ═══════════════════════════════════════════════════════════════
# SPEC 2: SIXSIXSIX
# ═══════════════════════════════════════════════════════════════
cat > claude-code-sixsixsix.md << 'SPEC2'
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
SPEC2

echo "✅ Created claude-code-sixsixsix.md"

# ═══════════════════════════════════════════════════════════════
# SPEC 3: 3-PUTT POKER
# ═══════════════════════════════════════════════════════════════
cat > claude-code-3putt-poker.md << 'SPEC3'
# CLAUDE CODE: Implement 3-Putt Poker Side Game

Implement 3-Putt Poker as a premium side game with poker hand tracking, card animations, and best-hand calculation. Commit when complete.

## GAME OVERVIEW

3-Putt Poker combines putting with poker:
- One-putt: Earn 1 playing card
- Hole-out (chip-in): Earn 2 cards
- Two-putt: Nothing
- Three-putt+: Add $1 per extra putt to pot, receive "Worst Putter Chip"
- End of round: Best poker hand wins pot

## STATE STRUCTURE

```typescript
interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
  value: number;  // 2-14
}

interface ThreePuttPokerState {
  deck: Card[];
  deckIndex: number;
  ante: number;
  threePuttPenalty: number;
  pot: number;
  worstPutterChipHolder: string | null;
  worstPutterPenalty: number;
  players: {
    [playerId: string]: {
      cards: Card[];
      putts: { [holeIdx: number]: number };
      contributions: number;
      onePutts: number;
      threePutts: number;
    }
  };
}

type PokerHandRank = 'royal_flush' | 'straight_flush' | 'four_of_kind' | 
  'full_house' | 'flush' | 'straight' | 'three_of_kind' | 'two_pair' | 'pair' | 'high_card';
```

## POKER HAND EVALUATION

Implement full poker hand ranking:
1. Royal Flush (10), 2. Straight Flush (9), 3. Four of a Kind (8), 
4. Full House (7), 5. Flush (6), 6. Straight (5), 7. Three of a Kind (4),
8. Two Pair (3), 9. Pair (2), 10. High Card (1)

Find best 5-card hand from all cards player has earned. Use high cards for tiebreaking.

## DECK & DEALING

```typescript
function createShuffledDeck(): Card[] {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];
  for (const suit of suits) {
    for (let i = 0; i < ranks.length; i++) {
      deck.push({ suit, rank: ranks[i], value: i + 2 });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
```

## UI COMPONENTS

1. Putt Input: After each hole, selector for 0/1/2/3/4+ putts
2. Card Display: Visual playing cards with suits (♥♦♣♠), fan layout
3. Worst Putter Chip: Animated chip icon next to current holder
4. Leaderboard: Rank by hand strength, show card count and hand name
5. Settlement Showdown: Reveal all hands, show winner, pot distribution

## CINEMATIC MOMENTS

1. ROYAL_FLUSH: 👑 "ROYAL/FLUSH" - "Against all odds." (purple/gold gradient)
2. STRAIGHT_FLUSH: 🃏 "STRAIGHT/FLUSH" - "Five in a row. All suited up."
3. FOUR_OF_KIND: 🎰 "FOUR OF/A KIND" - "The odds were never in their favor."
4. WORST_PUTTER: 🎰 "WORST/PUTTER" - "Someone had to be." (red/black gradient)

## FILES TO CREATE

- src/services/poker.service.ts — Hand evaluation functions
- src/components/scoring/PokerCard.tsx — Card visual
- src/components/scoring/PokerHand.tsx — Fan display
- src/components/scoring/PuttInput.tsx — Putt selector
- src/components/scoring/ThreePuttPokerTicker.tsx
- src/components/scoring/ThreePuttPokerRecap.tsx

## FILES TO MODIFY

- src/data/scoring.ts — Add 'three_putt_poker' to side games
- src/scoring/useScoringState.ts — Add threePuttPokerState
- src/components/DormieMoment.tsx — Add poker moments
- app/scoring.tsx — Wire putt input after score entry
SPEC3

echo "✅ Created claude-code-3putt-poker.md"

# ═══════════════════════════════════════════════════════════════
# SPEC 4: 4-TEAM RYDER CUP
# ═══════════════════════════════════════════════════════════════
cat > claude-code-4team-ryder.md << 'SPEC4'
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
SPEC4

echo "✅ Created claude-code-4team-ryder.md"

# ═══════════════════════════════════════════════════════════════
# RUN BATCH IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════
echo ""
echo "🏌️ STARTING BATCH IMPLEMENTATION"
echo "================================="

SPECS=(
  "claude-code-low-high.md"
  "claude-code-sixsixsix.md"
  "claude-code-3putt-poker.md"
  "claude-code-4team-ryder.md"
)

for spec in "${SPECS[@]}"; do
  echo ""
  echo "▶️  Implementing: $spec"
  echo "─────────────────────────────────────────"
  
  claude -p "Read $spec in the current directory and implement everything it specifies. Create all files, add all logic, wire all components. Follow the existing Dormie codebase patterns. Commit with a descriptive message when complete."
  
  echo ""
  echo "✅ Completed: $spec"
  echo ""
  sleep 2
done

echo ""
echo "================================="
echo "🎉 BATCH COMPLETE"
echo ""
echo "Review commits: git log --oneline -10"
echo "Check changes:  git diff HEAD~4"
echo "When ready:     git push origin batch-new-formats"

