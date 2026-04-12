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
