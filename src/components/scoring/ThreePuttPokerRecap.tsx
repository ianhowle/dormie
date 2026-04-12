import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { Avatar } from '../Avatar';
import { PokerHand } from './PokerHand';
import { evaluateBestHand, compareEvaluations } from '../../services/poker.service';
import type { PlayerConfig } from '../../scoring/types';
import type { ThreePuttPokerPlayerState } from './ThreePuttPokerTicker';

export function ThreePuttPokerRecap({
  players,
  perPlayer,
  pot,
  worstPutterChipHolder,
}: {
  players: PlayerConfig[];
  perPlayer: Record<string, ThreePuttPokerPlayerState>;
  pot: number;
  worstPutterChipHolder: string | null;
}) {
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

  const winner = ranked[0]?.ev ? ranked[0] : null;

  return (
    <View style={[styles.container, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.gold, fontFamily: GEO }]}>3-PUTT POKER</Text>

      <View style={[styles.potBox, { borderColor: c.gold }]}>
        <Ionicons name="trophy" size={16} color={c.gold} />
        <Text style={[styles.potLabel, { color: c.textMuted }]}>POT</Text>
        <Text style={[styles.potValue, { color: c.gold, fontFamily: GEO }]}>${pot}</Text>
      </View>

      {winner && (
        <View style={[styles.winnerBox, { borderColor: c.gold, backgroundColor: `${c.gold}10` }]}>
          <Text style={[styles.winnerKicker, { color: c.gold, fontFamily: GEO }]}>SHOWDOWN WINNER</Text>
          <Text style={[styles.winnerName, { color: c.text, fontFamily: GEO }]}>
            {winner.player.id === '1' ? 'You' : winner.player.name}
          </Text>
          <Text style={[styles.winnerHand, { color: c.gold }]}>{winner.ev!.label}</Text>
          <View style={{ marginTop: 10 }}>
            <PokerHand cards={winner.ev!.bestFive} size="md" highlightCards={winner.ev!.bestFive} />
          </View>
        </View>
      )}

      {ranked.map(({ player, state, ev }, idx) => {
        if (!state) return null;
        const isWinner = idx === 0 && ev;
        return (
          <View key={player.id} style={[styles.playerCard, { borderColor: c.border }]}>
            <View style={styles.playerHeader}>
              <Text style={[styles.rank, { color: c.textMuted, fontFamily: GEO }]}>{idx + 1}</Text>
              <Avatar id={player.id} size={24} name={player.name} />
              <Text style={[styles.playerName, { color: c.text }]}>
                {player.id === '1' ? 'You' : player.name}
              </Text>
              {worstPutterChipHolder === player.id && (
                <View style={[styles.chip, { backgroundColor: c.urgent }]}>
                  <Text style={styles.chipText}>WORST PUTTER</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <Text style={[styles.handLabel, { color: isWinner ? c.gold : c.text }]}>
                {ev ? ev.label : 'No cards'}
              </Text>
            </View>
            {state.cards.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <PokerHand cards={state.cards} size="sm" highlightCards={ev?.bestFive ?? []} />
              </View>
            )}
            <View style={styles.statsRow}>
              <StatItem label="1-putts" value={state.onePutts} c={c} />
              <StatItem label="Chip-ins" value={state.chipIns} c={c} />
              <StatItem label="3-putts" value={state.threePutts} c={c} />
              <StatItem label="Cards" value={state.cards.length} c={c} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StatItem({ label, value, c }: { label: string; value: number; c: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: c.text, fontFamily: GEO }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderWidth: 1, marginVertical: 12 },
  title: { fontSize: 11, letterSpacing: 2, textAlign: 'center', marginBottom: 12 },
  potBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 10, borderWidth: 1, marginBottom: 16,
  },
  potLabel: { fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  potValue: { fontSize: 24 },
  winnerBox: {
    padding: 14, borderWidth: 1, marginBottom: 16, alignItems: 'center',
  },
  winnerKicker: { fontSize: 10, letterSpacing: 2 },
  winnerName: { fontSize: 22, marginTop: 4 },
  winnerHand: { fontSize: 13, fontWeight: '600', marginTop: 4, letterSpacing: 1 },
  playerCard: { padding: 10, borderWidth: 1, marginBottom: 8 },
  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rank: { fontSize: 12, width: 16, textAlign: 'center' },
  playerName: { fontSize: 14, fontWeight: '600' },
  handLabel: { fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16 },
  statLabel: { fontSize: 9, letterSpacing: 1, marginTop: 2 },
  chip: { paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { color: '#FFF', fontSize: 8, fontWeight: '700', letterSpacing: 1 },
});
