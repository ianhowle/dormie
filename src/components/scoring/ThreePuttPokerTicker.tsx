import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { Avatar } from '../Avatar';
import { PokerHand } from './PokerHand';
import { evaluateBestHand, compareEvaluations, type Card } from '../../services/poker.service';
import type { PlayerConfig } from '../../scoring/types';

export type ThreePuttPokerPlayerState = {
  cards: Card[];
  onePutts: number;
  threePutts: number;
  chipIns: number;
};

type Props = {
  players: PlayerConfig[];
  perPlayer: Record<string, ThreePuttPokerPlayerState>;
  pot: number;
  worstPutterChipHolder: string | null;
};

export function ThreePuttPokerTicker({ players, perPlayer, pot, worstPutterChipHolder }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const ranked = players
    .map((p) => {
      const st = perPlayer[p.id];
      const ev = st ? evaluateBestHand(st.cards) : null;
      return { player: p, state: st, ev };
    })
    .sort((a, b) => {
      if (!a.ev && !b.ev) return 0;
      if (!a.ev) return 1;
      if (!b.ev) return -1;
      return -compareEvaluations(a.ev, b.ev);
    });

  return (
    <View style={[styles.container, { backgroundColor: c.elevated, borderColor: c.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.gold, fontFamily: GEO }]}>3-PUTT POKER</Text>
        <View style={styles.potBox}>
          <Ionicons name="cash" size={14} color={c.gold} />
          <Text style={[styles.potText, { color: c.gold, fontFamily: GEO }]}>${pot}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
        {ranked.map(({ player, state, ev }, idx) => {
          if (!state) return null;
          const isYou = player.id === '1';
          const hasChip = worstPutterChipHolder === player.id;
          return (
            <View key={player.id} style={[styles.row, { borderColor: c.border }]}>
              <View style={styles.playerRow}>
                <Text style={[styles.rank, { color: c.textMuted, fontFamily: GEO }]}>{idx + 1}</Text>
                <Avatar id={player.id} size={22} name={player.name} />
                <Text style={[styles.name, { color: c.text }]}>{isYou ? 'You' : player.name.split(' ')[0]}</Text>
                {hasChip && (
                  <View style={[styles.chip, { backgroundColor: c.urgent }]}>
                    <Text style={styles.chipText}>3P</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Text style={[styles.handLabel, { color: ev && ev.rankValue >= 5 ? c.gold : c.text }]}>
                  {ev ? ev.label : '—'}
                </Text>
              </View>
              <View style={styles.cardsRow}>
                {state.cards.length > 0 ? (
                  <PokerHand cards={state.cards.slice(0, 7)} size="sm" highlightCards={ev?.bestFive ?? []} />
                ) : (
                  <Text style={[styles.emptyCards, { color: c.textMuted }]}>No cards yet</Text>
                )}
                <View style={{ flex: 1 }} />
                <Text style={[styles.count, { color: c.textMuted }]}>{state.cards.length} cards</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12, borderWidth: 1, marginHorizontal: 16, marginBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 11, letterSpacing: 2 },
  potBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  potText: { fontSize: 16 },
  row: { paddingVertical: 8, borderBottomWidth: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rank: { fontSize: 12, width: 14, textAlign: 'center' },
  name: { fontSize: 13, fontWeight: '600' },
  handLabel: { fontSize: 11, fontWeight: '600' },
  cardsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, minHeight: 48 },
  emptyCards: { fontSize: 11, fontStyle: 'italic' },
  count: { fontSize: 10 },
  chip: {
    paddingHorizontal: 6, paddingVertical: 2,
  },
  chipText: { color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
});
