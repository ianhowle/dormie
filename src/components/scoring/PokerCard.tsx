import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { SUIT_SYMBOL, isRedSuit, type Card } from '../../services/poker.service';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { w: number; h: number; corner: number; center: number }> = {
  sm: { w: 32, h: 44, corner: 9, center: 16 },
  md: { w: 46, h: 64, corner: 11, center: 22 },
  lg: { w: 60, h: 84, corner: 13, center: 30 },
};

export function PokerCard({
  card,
  size = 'md',
  highlighted = false,
  facedown = false,
}: {
  card: Card;
  size?: Size;
  highlighted?: boolean;
  facedown?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const dim = SIZES[size];
  const red = isRedSuit(card.suit);
  const color = facedown ? c.textMuted : red ? '#C41E3A' : '#111111';
  const bg = facedown ? c.elevated : '#FAF8F4';
  const borderColor = highlighted ? c.gold : c.border;

  if (facedown) {
    return (
      <View style={[styles.card, { width: dim.w, height: dim.h, backgroundColor: bg, borderColor }]}>
        <View style={[styles.backPattern, { borderColor: c.gold }]}>
          <Text style={{ color: c.gold, fontSize: dim.center * 0.6, fontFamily: GEO }}>D</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { width: dim.w, height: dim.h, backgroundColor: bg, borderColor, borderWidth: highlighted ? 2 : 1 }]}>
      <Text style={[styles.corner, { color, fontSize: dim.corner, top: 2, left: 4 }]}>
        {card.rank}
      </Text>
      <Text style={[styles.centerSymbol, { color, fontSize: dim.center }]}>
        {SUIT_SYMBOL[card.suit]}
      </Text>
      <Text style={[styles.corner, { color, fontSize: dim.corner, bottom: 2, right: 4, transform: [{ rotate: '180deg' }] }]}>
        {card.rank}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', fontWeight: '700' },
  centerSymbol: { fontWeight: '700' },
  backPattern: {
    flex: 1, alignSelf: 'stretch', margin: 3,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
});
