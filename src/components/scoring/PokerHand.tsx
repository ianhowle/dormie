import { View, StyleSheet } from 'react-native';
import { PokerCard } from './PokerCard';
import type { Card } from '../../services/poker.service';

export function PokerHand({
  cards,
  size = 'md',
  highlightCards = [],
}: {
  cards: Card[];
  size?: 'sm' | 'md' | 'lg';
  highlightCards?: Card[];
}) {
  if (cards.length === 0) return null;
  const overlap = size === 'sm' ? -18 : size === 'md' ? -24 : -32;
  const isHighlighted = (c: Card) =>
    highlightCards.some((h) => h.rank === c.rank && h.suit === c.suit);

  return (
    <View style={styles.row}>
      {cards.map((card, i) => (
        <View key={`${card.suit}-${card.rank}-${i}`} style={{ marginLeft: i === 0 ? 0 : overlap }}>
          <PokerCard card={card} size={size} highlighted={isHighlighted(card)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
