import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { haptics } from '../lib/haptics';
import { Avatar } from './Avatar';

// ─── Types ───────────────────────────────────────────────────────────
export type MatchupState = 'upcoming' | 'in_progress' | 'complete';

export type WeeklyMatchupData = {
  week: number;
  state: MatchupState;
  format: string;
  playerName: string;
  playerId: string;
  playerScore: number | null;
  opponentName: string;
  opponentId: string;
  opponentScore: number | null;
  seriesRecord: { wins: number; losses: number; ties: number } | null;
  isDivisionGame: boolean;
};

type Props = {
  matchup: WeeklyMatchupData;
  onPress?: () => void;
};

const FORMAT_LABELS: Record<string, string> = {
  stableford: 'Stableford',
  modified_stableford: 'Mod. Stableford',
  stroke_net: 'Stroke (Net)',
  stroke_gross: 'Stroke (Gross)',
  quota: 'Quota',
  best9: 'Best 9',
  match_play: 'Match Play',
  nassau: 'Nassau',
  skins: 'Skins',
  best_ball: 'Best Ball',
  scramble: 'Scramble',
  chapman: 'Chapman',
};

// ─── Helpers ─────────────────────────────────────────────────────────
function seriesText(record: { wins: number; losses: number; ties: number } | null): string {
  if (!record) return 'First meeting';
  const { wins, losses, ties } = record;
  if (wins === 0 && losses === 0 && ties === 0) return 'First meeting';
  if (wins > losses) return `You lead ${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
  if (losses > wins) return `You trail ${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
  return `Series tied ${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
}

// ─── Component ───────────────────────────────────────────────────────
export function WeeklyMatchupCard({ matchup, onPress }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const {
    week, state, format, playerName, playerId, playerScore,
    opponentName, opponentId, opponentScore, seriesRecord, isDivisionGame,
  } = matchup;

  const isComplete = state === 'complete';
  const playerWon = isComplete && playerScore !== null && opponentScore !== null && playerScore > opponentScore;
  const opponentWon = isComplete && playerScore !== null && opponentScore !== null && opponentScore > playerScore;
  const margin = isComplete && playerScore !== null && opponentScore !== null
    ? Math.abs(playerScore - opponentScore)
    : null;

  return (
    <Pressable
      onPress={() => { haptics.light(); onPress?.(); }}
      style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={[styles.weekLabel, { color: c.gold, fontFamily: GEO }]}>
          WEEK {week} MATCHUP
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isDivisionGame && (
            <View style={[styles.formatBadge, { backgroundColor: c.gold + '22' }]}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: c.gold, letterSpacing: 0.5 }}>DIV</Text>
            </View>
          )}
          <View style={[styles.formatBadge, { backgroundColor: c.elevated }]}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5 }}>
              {FORMAT_LABELS[format] ?? format}
            </Text>
          </View>
        </View>
      </View>

      {/* Matchup row */}
      <View style={styles.matchupRow}>
        {/* Player side */}
        <View style={[styles.playerSide, playerWon && { borderColor: c.gold, borderWidth: 1 }]}>
          <Avatar id={playerId} name={playerName} size={36} />
          <Text style={[styles.sideName, { color: c.text }]} numberOfLines={1}>{playerName}</Text>
          {playerScore !== null ? (
            <Text style={[styles.sideScore, { color: playerWon ? c.gold : c.text, fontFamily: GEO }]}>
              {playerScore}
            </Text>
          ) : (
            <Text style={[styles.sideWaiting, { color: c.textMuted }]}>
              {state === 'upcoming' ? '—' : 'Awaiting\nround'}
            </Text>
          )}
        </View>

        {/* Center */}
        <View style={styles.center}>
          <Text style={[styles.vsText, { color: c.textMuted }]}>vs</Text>
          {margin !== null && (
            <Text
              style={[
                styles.marginText,
                { color: playerWon ? c.teal : opponentWon ? c.urgent : c.textMuted, fontFamily: GEO },
              ]}
            >
              {playerWon ? `+${margin}` : opponentWon ? `-${margin}` : 'TIE'}
            </Text>
          )}
        </View>

        {/* Opponent side */}
        <View style={[styles.playerSide, opponentWon && { borderColor: c.gold, borderWidth: 1 }]}>
          <Avatar id={opponentId} name={opponentName} size={36} />
          <Text style={[styles.sideName, { color: c.text }]} numberOfLines={1}>{opponentName}</Text>
          {opponentScore !== null ? (
            <Text style={[styles.sideScore, { color: opponentWon ? c.gold : c.text, fontFamily: GEO }]}>
              {opponentScore}
            </Text>
          ) : (
            <Text style={[styles.sideWaiting, { color: c.textMuted }]}>
              {state === 'upcoming' ? '—' : 'Awaiting\nround'}
            </Text>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={{ fontSize: 11, color: c.textMuted }}>{seriesText(seriesRecord)}</Text>
        {state === 'upcoming' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: c.teal }}>Log your round</Text>
            <Ionicons name="arrow-forward" size={12} color={c.teal} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Demo Data ───────────────────────────────────────────────────────
export function buildDemoMatchup(): WeeklyMatchupData {
  return {
    week: 7,
    state: 'complete',
    format: 'stableford',
    playerName: 'You',
    playerId: 'self',
    playerScore: 38,
    opponentName: 'McGowan',
    opponentId: '1',
    opponentScore: 32,
    seriesRecord: { wins: 2, losses: 1, ties: 0 },
    isDivisionGame: true,
  };
}

export function buildDemoMatchupInProgress(): WeeklyMatchupData {
  return {
    week: 7,
    state: 'in_progress',
    format: 'stableford',
    playerName: 'You',
    playerId: 'self',
    playerScore: 38,
    opponentName: 'McGowan',
    opponentId: '1',
    opponentScore: null,
    seriesRecord: { wins: 2, losses: 1, ties: 0 },
    isDivisionGame: true,
  };
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  weekLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  formatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  playerSide: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  sideName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  sideScore: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
  },
  sideWaiting: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  center: {
    width: 44,
    alignItems: 'center',
    gap: 4,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  marginText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FFFFFF11',
  },
});
