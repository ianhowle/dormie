import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { LowHighPoints, LowHighOptions, PlayerConfig } from '../../scoring/types';

type Props = {
  points: LowHighPoints;
  options: LowHighOptions;
  teams: { team1: string[]; team2: string[] };
  players: PlayerConfig[];
};

function teamNames(ids: string[], players: PlayerConfig[]) {
  return ids
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is PlayerConfig => !!p)
    .map((p) => (p.id === '1' ? 'You' : p.name.split(' ')[0]))
    .join(' & ');
}

export function LowHighRecap({ points, options, teams, players }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const winner =
    points.team1 > points.team2 ? 'team1' :
    points.team2 > points.team1 ? 'team2' : 'tied';

  const diff = Math.abs(points.team1 - points.team2);
  const headline =
    winner === 'tied'
      ? 'All Square'
      : `${winner === 'team1' ? 'Team 1' : 'Team 2'} wins by ${diff}`;

  return (
    <View style={[styles.container, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.gold, fontFamily: GEO }]}>LOW BALL / HIGH BALL</Text>
      <Text style={[styles.headline, { color: c.text, fontFamily: GEO }]}>{headline}</Text>

      <View style={styles.row}>
        <View style={styles.teamCol}>
          <Text style={[styles.teamTag, { color: c.teal }]}>TEAM 1</Text>
          <Text style={[styles.players, { color: c.textMuted }]}>{teamNames(teams.team1, players)}</Text>
          <Text style={[styles.total, { color: c.text, fontFamily: GEO }]}>{points.team1}</Text>
        </View>
        <Text style={[styles.vs, { color: c.textMuted }]}>—</Text>
        <View style={styles.teamCol}>
          <Text style={[styles.teamTag, { color: c.gold }]}>TEAM 2</Text>
          <Text style={[styles.players, { color: c.textMuted }]}>{teamNames(teams.team2, players)}</Text>
          <Text style={[styles.total, { color: c.text, fontFamily: GEO }]}>{points.team2}</Text>
        </View>
      </View>

      <View style={[styles.breakdown, { borderColor: c.border }]}>
        <BreakdownRow label="Low Ball" left={points.lowT1} right={points.lowT2} c={c} />
        <BreakdownRow label="High Ball" left={points.highT1} right={points.highT2} c={c} />
        {options.includeTotal && (
          <BreakdownRow label="Total" left={points.totalT1} right={points.totalT2} c={c} />
        )}
        {options.tieHandling === 'carryover' && points.carryover > 0 && (
          <Text style={[styles.carry, { color: c.textMuted }]}>
            {points.carryover} point{points.carryover === 1 ? '' : 's'} still in carryover
          </Text>
        )}
      </View>
    </View>
  );
}

function BreakdownRow({ label, left, right, c }: { label: string; left: number; right: number; c: any }) {
  return (
    <View style={styles.brRow}>
      <Text style={[styles.brLeft, { color: c.teal, fontFamily: GEO }]}>{left}</Text>
      <Text style={[styles.brLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.brRight, { color: c.gold, fontFamily: GEO }]}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderWidth: 1, marginVertical: 12 },
  title: { fontSize: 11, letterSpacing: 2, textAlign: 'center', marginBottom: 8 },
  headline: { fontSize: 20, textAlign: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamCol: { flex: 1, alignItems: 'center' },
  teamTag: { fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  players: { fontSize: 11, marginTop: 2 },
  total: { fontSize: 32, marginTop: 4 },
  vs: { fontSize: 14, marginHorizontal: 8 },
  breakdown: { marginTop: 16, paddingTop: 12, borderTopWidth: 1 },
  brRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  brLeft: { fontSize: 14, width: 50, textAlign: 'left' },
  brLabel: { fontSize: 11, letterSpacing: 1 },
  brRight: { fontSize: 14, width: 50, textAlign: 'right' },
  carry: { fontSize: 10, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
});
