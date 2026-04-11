import { View, Text, ScrollView, Pressable, StyleSheet, Platform, StatusBar, Dimensions } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { MatchupScoutingSection } from '../src/components/SeasonStatsSection';
import { haptics } from '../src/lib/haptics';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Types ───────────────────────────────────────────────────────────
type HistoricalMatchup = {
  week: number;
  season: string;
  playerScore: number;
  opponentScore: number;
  format: string;
  won: boolean;
};

// ─── Demo Data ───────────────────────────────────────────────────────
const DEMO_HISTORY: HistoricalMatchup[] = [
  { week: 3, season: 'Spring 2026', playerScore: 36, opponentScore: 33, format: 'stableford', won: true },
  { week: 5, season: 'Spring 2026', playerScore: 31, opponentScore: 34, format: 'modified_stableford', won: false },
  { week: 7, season: 'Spring 2026', playerScore: 38, opponentScore: 32, format: 'stableford', won: true },
  { week: 9, season: 'Fall 2025', playerScore: 35, opponentScore: 35, format: 'stableford', won: false },
  { week: 4, season: 'Fall 2025', playerScore: 29, opponentScore: 37, format: 'quota', won: false },
];

const FORMAT_LABELS: Record<string, string> = {
  stableford: 'Stableford',
  modified_stableford: 'Mod. Stableford',
  stroke_net: 'Stroke (Net)',
  stroke_gross: 'Stroke (Gross)',
  quota: 'Quota',
  best9: 'Best 9',
  match_play: 'Match Play',
};

// ─── Screen ──────────────────────────────────────────────────────────
export default function LeagueMatchupDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{
    playerName?: string;
    playerId?: string;
    opponentName?: string;
    opponentId?: string;
    playerScore?: string;
    opponentScore?: string;
    week?: string;
    format?: string;
    state?: string;
  }>();

  const playerName = params.playerName ?? 'You';
  const playerId = params.playerId ?? 'self';
  const opponentName = params.opponentName ?? 'Opponent';
  const opponentId = params.opponentId ?? '0';
  const playerScore = params.playerScore ? parseInt(params.playerScore, 10) : null;
  const opponentScore = params.opponentScore ? parseInt(params.opponentScore, 10) : null;
  const week = params.week ? parseInt(params.week, 10) : 0;
  const format = params.format ?? 'stableford';
  const state = params.state ?? 'complete';

  const isComplete = state === 'complete' && playerScore !== null && opponentScore !== null;
  const playerWon = isComplete && playerScore! > opponentScore!;
  const opponentWon = isComplete && opponentScore! > playerScore!;
  const margin = isComplete ? Math.abs(playerScore! - opponentScore!) : null;

  // H2H record from demo data
  const h2hWins = DEMO_HISTORY.filter((h) => h.won).length;
  const h2hLosses = DEMO_HISTORY.filter((h) => !h.won).length;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={greenHeaderGradient as unknown as string[]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: GEO }]}>Week {week} Matchup</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Head-to-head display */}
        <View style={styles.h2hRow}>
          <View style={styles.h2hPlayer}>
            <Avatar id={playerId} name={playerName} size={48} />
            <Text style={styles.h2hName}>{playerName}</Text>
          </View>

          <View style={styles.h2hCenter}>
            {isComplete ? (
              <>
                <View style={styles.scoreRow}>
                  <Text style={[styles.h2hScore, { color: playerWon ? '#C9A227' : '#FFFFFF' }]}>
                    {playerScore}
                  </Text>
                  <Text style={styles.h2hDash}>—</Text>
                  <Text style={[styles.h2hScore, { color: opponentWon ? '#C9A227' : '#FFFFFF' }]}>
                    {opponentScore}
                  </Text>
                </View>
                {margin !== null && margin > 0 && (
                  <Text style={[styles.marginBadge, { color: playerWon ? '#006747' : '#C41E3A' }]}>
                    {playerWon ? `+${margin}` : `-${margin}`}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.h2hVs}>vs</Text>
            )}
          </View>

          <View style={styles.h2hPlayer}>
            <Avatar id={opponentId} name={opponentName} size={48} />
            <Text style={styles.h2hName}>{opponentName}</Text>
          </View>
        </View>

        {/* Format badge */}
        <View style={styles.formatRow}>
          <View style={[styles.formatBadge, { backgroundColor: '#FFFFFF12' }]}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFFAA' }}>
              {FORMAT_LABELS[format] ?? format}
            </Text>
          </View>
        </View>
      </LinearGradient>
      <GoldDivider />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Status section */}
        {!isComplete && (
          <View style={[styles.statusCard, { backgroundColor: c.elevated }]}>
            <Ionicons name="time-outline" size={20} color={c.gold} />
            <View style={{ flex: 1 }}>
              {playerScore !== null && opponentScore === null && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>
                    Your score: {playerScore}
                  </Text>
                  <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>
                    Waiting for {opponentName} to log their round
                  </Text>
                </>
              )}
              {playerScore === null && (
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>
                  Log your round to complete this matchup
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Head-to-Head Record */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.gold }]}>HEAD-TO-HEAD RECORD</Text>
          <View style={[styles.h2hRecordCard, { backgroundColor: c.elevated }]}>
            <View style={styles.h2hRecordRow}>
              <View style={styles.h2hRecordSide}>
                <Text style={[styles.h2hRecordVal, { color: h2hWins > h2hLosses ? c.teal : c.text, fontFamily: GEO }]}>
                  {h2hWins}
                </Text>
                <Text style={[styles.h2hRecordLabel, { color: c.textMuted }]}>Wins</Text>
              </View>
              <View style={[styles.h2hRecordDivider, { backgroundColor: c.border }]} />
              <View style={styles.h2hRecordSide}>
                <Text style={[styles.h2hRecordVal, { color: h2hLosses > h2hWins ? c.urgent : c.text, fontFamily: GEO }]}>
                  {h2hLosses}
                </Text>
                <Text style={[styles.h2hRecordLabel, { color: c.textMuted }]}>Losses</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Matchup Scouting */}
        <MatchupScoutingSection opponentId={opponentId} />

        {/* Historical Matchups */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.gold }]}>PREVIOUS MEETINGS</Text>
          {DEMO_HISTORY.map((h, i) => (
            <View
              key={i}
              style={[styles.historyRow, { borderBottomColor: c.border, backgroundColor: c.elevated }]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, color: c.textMuted }}>
                    {h.season} · Wk {h.week}
                  </Text>
                  <View style={{ paddingHorizontal: 5, paddingVertical: 1, backgroundColor: h.won ? c.teal + '22' : c.urgent + '22' }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: h.won ? c.teal : c.urgent }}>
                      {h.won ? 'W' : 'L'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>
                  {FORMAT_LABELS[h.format] ?? h.format}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, fontFamily: GEO }}>
                {h.playerScore}-{h.opponentScore}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: STATUS_BAR_H + 8, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  h2hPlayer: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  h2hName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  h2hCenter: {
    width: 80,
    alignItems: 'center',
    gap: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  h2hScore: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: GEO,
  },
  h2hDash: {
    fontSize: 18,
    color: '#FFFFFF66',
  },
  h2hVs: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF66',
  },
  marginBadge: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: GEO,
    marginTop: 2,
  },
  formatRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  formatBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    margin: 12,
  },

  section: {
    paddingHorizontal: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  h2hRecordCard: {
    padding: 16,
  },
  h2hRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  h2hRecordSide: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  h2hRecordVal: {
    fontSize: 28,
    fontWeight: '700',
  },
  h2hRecordLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  h2hRecordDivider: {
    width: 1,
    height: 40,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 4,
  },
});
