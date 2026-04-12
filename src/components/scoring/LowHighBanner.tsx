import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { LowHighHoleResult, LowHighPoints } from '../../scoring/types';

type Props = {
  holeResult: LowHighHoleResult | undefined;
  points: LowHighPoints;
  includeTotal: boolean;
};

function winnerLabel(w: 'team1' | 'team2' | 'halved' | undefined, c: any) {
  if (!w) return { text: '—', color: c.textMuted };
  if (w === 'halved') return { text: 'HALVED', color: c.textMuted };
  return w === 'team1'
    ? { text: 'T1', color: c.teal }
    : { text: 'T2', color: c.gold };
}

export function LowHighBanner({ holeResult, points, includeTotal }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const low = winnerLabel(holeResult?.lowBallWinner, c);
  const high = winnerLabel(holeResult?.highBallWinner, c);
  const total = winnerLabel(holeResult?.totalWinner, c);

  return (
    <View style={[styles.banner, { backgroundColor: c.elevated, borderColor: c.border }]}>
      <View style={styles.scoreCol}>
        <Text style={[styles.teamLabel, { color: c.teal }]}>TEAM 1</Text>
        <Text style={[styles.points, { color: c.text, fontFamily: GEO }]}>
          {points.team1}
        </Text>
      </View>

      <View style={styles.center}>
        <View style={styles.row}>
          <Text style={[styles.tag, { color: c.textMuted }]}>LOW</Text>
          <Text style={[styles.winner, { color: low.color, fontFamily: GEO }]}>{low.text}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.tag, { color: c.textMuted }]}>HIGH</Text>
          <Text style={[styles.winner, { color: high.color, fontFamily: GEO }]}>{high.text}</Text>
        </View>
        {includeTotal && (
          <View style={styles.row}>
            <Text style={[styles.tag, { color: c.textMuted }]}>TOT</Text>
            <Text style={[styles.winner, { color: total.color, fontFamily: GEO }]}>{total.text}</Text>
          </View>
        )}
        {holeResult?.birdieBonus && (
          <Text style={[styles.birdie, { color: c.gold }]}>BIRDIE BONUS ×2</Text>
        )}
      </View>

      <View style={styles.scoreCol}>
        <Text style={[styles.teamLabel, { color: c.gold }]}>TEAM 2</Text>
        <Text style={[styles.points, { color: c.text, fontFamily: GEO }]}>
          {points.team2}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  scoreCol: { alignItems: 'center', minWidth: 70 },
  center: { flex: 1, paddingHorizontal: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 1 },
  teamLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  points: { fontSize: 24, marginTop: 2 },
  tag: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  winner: { fontSize: 13 },
  birdie: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4, textAlign: 'center' },
});
