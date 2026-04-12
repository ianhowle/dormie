export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export type Card = {
  suit: Suit;
  rank: Rank;
  value: number; // 2–14
};

export type PokerHandRank =
  | 'royal_flush'
  | 'straight_flush'
  | 'four_of_kind'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'three_of_kind'
  | 'two_pair'
  | 'pair'
  | 'high_card';

export const HAND_RANK_VALUE: Record<PokerHandRank, number> = {
  royal_flush: 10,
  straight_flush: 9,
  four_of_kind: 8,
  full_house: 7,
  flush: 6,
  straight: 5,
  three_of_kind: 4,
  two_pair: 3,
  pair: 2,
  high_card: 1,
};

export const HAND_RANK_LABEL: Record<PokerHandRank, string> = {
  royal_flush: 'Royal Flush',
  straight_flush: 'Straight Flush',
  four_of_kind: 'Four of a Kind',
  full_house: 'Full House',
  flush: 'Flush',
  straight: 'Straight',
  three_of_kind: 'Three of a Kind',
  two_pair: 'Two Pair',
  pair: 'Pair',
  high_card: 'High Card',
};

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    RANKS.forEach((rank, i) => deck.push({ suit, rank, value: i + 2 }));
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export type HandEvaluation = {
  rank: PokerHandRank;
  rankValue: number;
  bestFive: Card[];
  tiebreakers: number[]; // card values used for tie-breaking, most significant first
  label: string;
};

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  return [
    ...combinations(tail, k - 1).map((c) => [head, ...c]),
    ...combinations(tail, k),
  ];
}

function evaluateFive(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const values = sorted.map((c) => c.value);
  const suits = sorted.map((c) => c.suit);

  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const countEntries = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const groupSizes = countEntries.map((e) => e[1]);
  const groupValues = countEntries.map((e) => e[0]);

  const isFlush = suits.every((s) => s === suits[0]);

  // Straight detection (Ace-low wheel supported)
  let isStraight = false;
  let straightHigh = 0;
  const uniqueSorted = [...new Set(values)].sort((a, b) => b - a);
  if (uniqueSorted.length === 5) {
    if (uniqueSorted[0] - uniqueSorted[4] === 4) {
      isStraight = true;
      straightHigh = uniqueSorted[0];
    } else if (uniqueSorted[0] === 14 && uniqueSorted[1] === 5 && uniqueSorted[4] === 2) {
      isStraight = true;
      straightHigh = 5; // wheel
    }
  }

  let rank: PokerHandRank = 'high_card';
  let tiebreakers: number[] = values;

  if (isStraight && isFlush && straightHigh === 14) {
    rank = 'royal_flush';
    tiebreakers = [14];
  } else if (isStraight && isFlush) {
    rank = 'straight_flush';
    tiebreakers = [straightHigh];
  } else if (groupSizes[0] === 4) {
    rank = 'four_of_kind';
    tiebreakers = [groupValues[0], groupValues[1]];
  } else if (groupSizes[0] === 3 && groupSizes[1] === 2) {
    rank = 'full_house';
    tiebreakers = [groupValues[0], groupValues[1]];
  } else if (isFlush) {
    rank = 'flush';
    tiebreakers = values;
  } else if (isStraight) {
    rank = 'straight';
    tiebreakers = [straightHigh];
  } else if (groupSizes[0] === 3) {
    rank = 'three_of_kind';
    tiebreakers = [groupValues[0], ...groupValues.slice(1)];
  } else if (groupSizes[0] === 2 && groupSizes[1] === 2) {
    rank = 'two_pair';
    tiebreakers = [groupValues[0], groupValues[1], groupValues[2]];
  } else if (groupSizes[0] === 2) {
    rank = 'pair';
    tiebreakers = [groupValues[0], ...groupValues.slice(1)];
  }

  return {
    rank,
    rankValue: HAND_RANK_VALUE[rank],
    bestFive: sorted,
    tiebreakers,
    label: HAND_RANK_LABEL[rank],
  };
}

export function evaluateBestHand(cards: Card[]): HandEvaluation | null {
  if (cards.length === 0) return null;
  if (cards.length < 5) {
    // Partial evaluation: best we can do with what we have
    return evaluatePartial(cards);
  }
  const combos = combinations(cards, 5);
  let best: HandEvaluation | null = null;
  for (const combo of combos) {
    const ev = evaluateFive(combo);
    if (!best || compareEvaluations(ev, best) > 0) best = ev;
  }
  return best;
}

function evaluatePartial(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const values = sorted.map((c) => c.value);
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const countEntries = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const top = countEntries[0];
  let rank: PokerHandRank = 'high_card';
  if (top && top[1] === 4) rank = 'four_of_kind';
  else if (top && top[1] === 3 && countEntries[1]?.[1] === 2) rank = 'full_house';
  else if (top && top[1] === 3) rank = 'three_of_kind';
  else if (top && top[1] === 2 && countEntries[1]?.[1] === 2) rank = 'two_pair';
  else if (top && top[1] === 2) rank = 'pair';
  return {
    rank,
    rankValue: HAND_RANK_VALUE[rank],
    bestFive: sorted,
    tiebreakers: values,
    label: HAND_RANK_LABEL[rank],
  };
}

export function compareEvaluations(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Cards awarded based on putt count + chip-in detection.
// chipIn = hole-out without putting (putts === 0 with ball in cup)
export function cardsEarned({ putts, chipIn }: { putts: number; chipIn: boolean }): number {
  if (chipIn) return 2;
  if (putts === 1) return 1;
  return 0;
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}
