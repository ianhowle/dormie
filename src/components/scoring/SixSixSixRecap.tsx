import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { PlayerConfig, SixSixSixResult } from '../../scoring/types';

function nameFor(pid: string, players: PlayerConfig[]) {
  const p = players.find((pl) => pl.id === pid);
  if (!p) return '—';
  return p.id === '1' ? 'You' : p.name.split(' ')[0];
}

export function SixSixSixRecap({
  result,
  players,
}: {
  result: SixSixSixResult;
  players: PlayerConfig[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const sortedDots = Object.entries(result.dots).sort((a, b) => b[1] - a[1]);
  const topDots = sortedDots.length > 0 ? sortedDots[0][1] : 0;

  return (
    <View style={[styles.container, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.gold, fontFamily: GEO }]}>6-6-6 SETTLEMENT</Text>

      {result.segments.map((seg, idx) => {
        const label = ['Holes 1–6', 'Holes 7–12', 'Holes 13–18'][idx];
        const t1Names = `${nameFor(seg.team1[0], players)} & ${nameFor(seg.team1[1], players)}`;
        const t2Names = `${nameFor(seg.team2[0], players)} & ${nameFor(seg.team2[1], players)}`;
        const winnerText =
          seg.winner === 'team1' ? `${t1Names} won` :
          seg.winner === 'team2' ? `${t2Names} won` :
          seg.winner === 'halved' ? 'Halved' : 'In progress';
        return (
          <View key={idx} style={[styles.segCard, { borderColor: c.border }]}>
            <Text style={[styles.segLabel, { color: c.textMuted }]}>{label.toUpperCase()}</Text>
            <View style={styles.segRow}>
              <View style={styles.segTeam}>
                <Text style={[styles.segTeamTag, { color: c.teal }]}>{t1Names}</Text>
                <Text style={[styles.segScore, { color: c.text, fontFamily: GEO }]}>{seg.team1Wins}</Text>
              </View>
              <Text style={[styles.segVs, { color: c.textMuted }]}>—</Text>
              <View style={styles.segTeam}>
                <Text style={[styles.segTeamTag, { color: c.gold }]}>{t2Names}</Text>
                <Text style={[styles.segScore, { color: c.text, fontFamily: GEO }]}>{seg.team2Wins}</Text>
              </View>
            </View>
            <Text style={[styles.segWinner, { color: seg.winner === 'halved' ? c.textMuted : c.text }]}>{winnerText}</Text>
          </View>
        );
      })}

      <Text style={[styles.dotsTitle, { color: c.gold, fontFamily: GEO }]}>DOTS</Text>
      {sortedDots.map(([pid, dots]) => {
        const isTop = dots === topDots && dots > 0;
        return (
          <View key={pid} style={styles.dotsRow}>
            <Text style={[styles.dotsName, { color: isTop ? c.gold : c.text }]}>{nameFor(pid, players)}</Text>
            <Text style={[styles.dotsValue, { color: isTop ? c.gold : c.text, fontFamily: GEO }]}>{dots}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderWidth: 1, marginVertical: 12 },
  title: { fontSize: 11, letterSpacing: 2, textAlign: 'center', marginBottom: 12 },
  segCard: { padding: 10, borderWidth: 1, marginBottom: 8 },
  segLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  segRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segTeam: { flex: 1, alignItems: 'center' },
  segTeamTag: { fontSize: 11, fontWeight: '600' },
  segScore: { fontSize: 22, marginTop: 2 },
  segVs: { fontSize: 12, marginHorizontal: 6 },
  segWinner: { fontSize: 11, textAlign: 'center', marginTop: 6 },
  dotsTitle: { fontSize: 11, letterSpacing: 2, textAlign: 'center', marginTop: 12, marginBottom: 8 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dotsName: { fontSize: 14 },
  dotsValue: { fontSize: 18 },
});
