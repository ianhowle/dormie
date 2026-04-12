import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import {
  evaluateMatch,
  FORMAT_LABEL,
  type FourTeamRyderConfig,
  type FourTeamRyderMatchup,
} from '../../services/fourTeamRyder.service';

type Props = {
  match: FourTeamRyderMatchup;
  config: FourTeamRyderConfig;
  totalHoles?: number;
  onUpdateHole?: (holeIdx: number, winner: 'team1' | 'team2' | 'halved') => void;
  onOpenMatch?: () => void;
  compact?: boolean;
};

export function FourTeamRyderMatch({
  match, config, totalHoles = 18, onUpdateHole, onOpenMatch, compact = false,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const team1 = config.teams.find((t) => t.id === match.team1Id);
  const team2 = config.teams.find((t) => t.id === match.team2Id);
  if (!team1 || !team2) return null;

  const res = config.results[match.matchId];
  const evalRes = evaluateMatch(res?.holeResults ?? {}, totalHoles);
  const statusColor = evalRes.status === 'complete'
    ? (evalRes.matchWinner === 'halved' ? c.textMuted : c.gold)
    : evalRes.status === 'in_progress' ? c.teal : c.textMuted;
  const statusLabel = evalRes.status === 'complete'
    ? (evalRes.matchWinner === 'halved' ? 'HALVED' : 'FINAL')
    : evalRes.status === 'in_progress' ? 'LIVE' : 'UPCOMING';

  return (
    <Pressable
      onPress={onOpenMatch}
      style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}
    >
      <View style={styles.header}>
        <Text style={[styles.format, { color: c.textMuted }]}>{FORMAT_LABEL[match.format]}</Text>
        <View style={[styles.statusPill, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor, fontFamily: GEO }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.matchRow}>
        <View style={styles.teamCol}>
          <View style={[styles.teamStripe, { backgroundColor: team1.color }]} />
          <Text style={[styles.teamName, { color: c.text }]} numberOfLines={1}>{team1.name}</Text>
          <Text style={[styles.teamScore, { color: evalRes.matchWinner === 'team1' ? c.gold : c.text, fontFamily: GEO }]}>
            {evalRes.team1Holes}
          </Text>
        </View>

        <View style={styles.centerCol}>
          <Text style={[styles.margin, { color: c.textMuted, fontFamily: GEO }]}>{evalRes.margin || '—'}</Text>
          {!compact && evalRes.status !== 'complete' && (
            <Text style={[styles.holesPlayed, { color: c.textMuted }]}>
              {evalRes.holesPlayed}/{totalHoles} holes
            </Text>
          )}
        </View>

        <View style={styles.teamCol}>
          <View style={[styles.teamStripe, { backgroundColor: team2.color }]} />
          <Text style={[styles.teamName, { color: c.text }]} numberOfLines={1}>{team2.name}</Text>
          <Text style={[styles.teamScore, { color: evalRes.matchWinner === 'team2' ? c.gold : c.text, fontFamily: GEO }]}>
            {evalRes.team2Holes}
          </Text>
        </View>
      </View>

      {!compact && onUpdateHole && evalRes.status !== 'complete' && (
        <View style={styles.quickRow}>
          <Text style={[styles.quickLabel, { color: c.textMuted }]}>Next hole:</Text>
          <Pressable
            onPress={() => onUpdateHole(evalRes.holesPlayed + 1, 'team1')}
            style={[styles.quickBtn, { borderColor: team1.color }]}
          >
            <Text style={{ color: team1.color, fontSize: 11, fontWeight: '600' }}>{team1.name}</Text>
          </Pressable>
          <Pressable
            onPress={() => onUpdateHole(evalRes.holesPlayed + 1, 'halved')}
            style={[styles.quickBtn, { borderColor: c.textMuted }]}
          >
            <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '600' }}>Halve</Text>
          </Pressable>
          <Pressable
            onPress={() => onUpdateHole(evalRes.holesPlayed + 1, 'team2')}
            style={[styles.quickBtn, { borderColor: team2.color }]}
          >
            <Text style={{ color: team2.color, fontSize: 11, fontWeight: '600' }}>{team2.name}</Text>
          </Pressable>
        </View>
      )}

      {onOpenMatch && (
        <View style={styles.openRow}>
          <Text style={[styles.openText, { color: c.textMuted }]}>Tap for details</Text>
          <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderWidth: 1, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  format: { fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  statusText: { fontSize: 9, letterSpacing: 1 },
  matchRow: { flexDirection: 'row', alignItems: 'center' },
  teamCol: { flex: 1, alignItems: 'center' },
  teamStripe: { width: '60%', height: 3, marginBottom: 6 },
  teamName: { fontSize: 13, fontWeight: '600' },
  teamScore: { fontSize: 28, marginTop: 4 },
  centerCol: { minWidth: 70, alignItems: 'center' },
  margin: { fontSize: 14, letterSpacing: 1 },
  holesPlayed: { fontSize: 10, marginTop: 2 },
  quickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 6 },
  quickLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  quickBtn: { flex: 1, paddingVertical: 6, borderWidth: 1, alignItems: 'center' },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 2 },
  openText: { fontSize: 10 },
});
