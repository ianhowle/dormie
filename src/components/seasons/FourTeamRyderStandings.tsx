import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { computeStandings, type FourTeamRyderConfig } from '../../services/fourTeamRyder.service';

export function FourTeamRyderStandings({
  config,
  compact = false,
}: {
  config: FourTeamRyderConfig;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const standings = computeStandings(config);
  const leaderPoints = standings[0]?.totalPoints ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      {!compact && (
        <Text style={[styles.title, { color: c.gold, fontFamily: GEO }]}>STANDINGS</Text>
      )}

      <View style={[styles.headerRow, { borderColor: c.border }]}>
        <Text style={[styles.hCell, styles.hRank, { color: c.textMuted }]}>#</Text>
        <Text style={[styles.hCell, styles.hTeam, { color: c.textMuted }]}>TEAM</Text>
        <Text style={[styles.hCell, styles.hNum, { color: c.textMuted }]}>W</Text>
        <Text style={[styles.hCell, styles.hNum, { color: c.textMuted }]}>L</Text>
        <Text style={[styles.hCell, styles.hNum, { color: c.textMuted }]}>H</Text>
        <Text style={[styles.hCell, styles.hPts, { color: c.textMuted }]}>PTS</Text>
      </View>

      {standings.map((s, idx) => {
        const team = config.teams.find((t) => t.id === s.teamId);
        if (!team) return null;
        const leader = idx === 0 && s.totalPoints > 0;
        return (
          <View key={s.teamId} style={[styles.row, { borderColor: c.border }]}>
            <Text style={[styles.cell, styles.rank, { color: c.text, fontFamily: GEO }]}>{idx + 1}</Text>
            <View style={[styles.cell, styles.teamCell]}>
              <View style={[styles.dot, { backgroundColor: team.color }]} />
              <Text style={[styles.teamName, { color: c.text }]} numberOfLines={1}>{team.name}</Text>
              {leader && <Ionicons name="trophy" size={12} color={c.gold} style={{ marginLeft: 4 }} />}
            </View>
            <Text style={[styles.cell, styles.num, { color: c.text, fontFamily: GEO }]}>{s.matchesWon}</Text>
            <Text style={[styles.cell, styles.num, { color: c.text, fontFamily: GEO }]}>{s.matchesLost}</Text>
            <Text style={[styles.cell, styles.num, { color: c.text, fontFamily: GEO }]}>{s.matchesHalved}</Text>
            <Text style={[styles.cell, styles.pts, { color: leader ? c.gold : c.text, fontFamily: GEO }]}>
              {s.totalPoints}
            </Text>
          </View>
        );
      })}

      {!compact && (
        <Text style={[styles.footnote, { color: c.textMuted }]}>
          Leader: {leaderPoints} pts · First to {config.pointsToWin} clinches
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, borderWidth: 1 },
  title: { fontSize: 11, letterSpacing: 2, textAlign: 'center', marginBottom: 10 },
  headerRow: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, marginBottom: 4 },
  hCell: { fontSize: 9, letterSpacing: 1, fontWeight: '600' },
  hRank: { width: 24, textAlign: 'center' },
  hTeam: { flex: 1 },
  hNum: { width: 28, textAlign: 'center' },
  hPts: { width: 40, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { },
  rank: { width: 24, textAlign: 'center', fontSize: 14 },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10 },
  teamName: { fontSize: 13, flex: 1 },
  num: { width: 28, textAlign: 'center', fontSize: 13 },
  pts: { width: 40, textAlign: 'right', fontSize: 16 },
  footnote: { fontSize: 10, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
});
