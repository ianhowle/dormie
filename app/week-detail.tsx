import { View, Text, ScrollView, Pressable, StyleSheet, Platform, StatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { haptics } from '../src/lib/haptics';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

const POINTS_TABLE = [25, 20, 16, 12, 10, 8, 6, 4, 2, 1];

const FORMAT_LABELS: Record<string, string> = {
  stableford: 'Stableford',
  modified_stableford: 'Mod. Stableford',
  stroke_net: 'Stroke (Net)',
  quota: 'Quota',
  best9: 'Best 9',
};

// Demo players matching season-detail standings
const DEMO_PLAYERS = [
  { playerId: '1', name: 'McGowan', handicap: 8, avatarColor: '#006747' },
  { playerId: '2', name: 'Fletcher', handicap: 12, avatarColor: '#C9A227' },
  { playerId: '3', name: 'Patterson', handicap: 6, avatarColor: '#1E4D2B' },
  { playerId: '4', name: 'Sullivan', handicap: 15, avatarColor: '#C41E3A' },
  { playerId: '5', name: 'Rodriguez', handicap: 10, avatarColor: '#006747' },
  { playerId: '6', name: 'Chen', handicap: 18, avatarColor: '#C9A227' },
  { playerId: '7', name: 'Taylor', handicap: 14, avatarColor: '#1E4D2B' },
  { playerId: '8', name: 'Brooks', handicap: 20, avatarColor: '#C41E3A' },
];

// Week results per player (index = week-1, value = points earned that week)
// Matches DEMO_STANDINGS weekResults from season-detail.tsx
const DEMO_WEEK_RESULTS: Record<string, number[]> = {
  '1': [25, 16, 20, 12],
  '2': [20, 25, 12, 8],
  '3': [16, 12, 25, 4],
  '4': [12, 20, 10, 2],
  '5': [10, 8, 16, 6],
  '6': [8, 10, 6, 6],
  '7': [6, 4, 8, 4],
  '8': [4, 6, 2, 2],
};

// Demo week configs matching buildDemoWeeks
const DEMO_WEEK_CONFIGS = [
  { format: 'stableford', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'modified_stableford', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'stroke_net', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'quota', isMajor: true, majorName: 'The Masters', multiplier: 2 },
  { format: 'best9', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'stableford', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'modified_stableford', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'stroke_net', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'quota', isMajor: true, majorName: 'The Open', multiplier: 2 },
  { format: 'best9', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'stableford', isMajor: false, majorName: null, multiplier: 1 },
  { format: 'modified_stableford', isMajor: false, majorName: null, multiplier: 1 },
];

// Gross scores for display (fabricated per-week demo data)
const DEMO_GROSS_SCORES: Record<string, number[]> = {
  '1': [74, 78, 76, 80, 82, 84, 86, 90],
  '2': [76, 74, 80, 78, 84, 82, 88, 86],
  '3': [78, 80, 74, 82, 76, 86, 84, 90],
  '4': [80, 78, 82, 90, 84, 86, 88, 92],
};

function getWeekResults(weekNumber: number) {
  const results = DEMO_PLAYERS.map((player, idx) => {
    const weekResults = DEMO_WEEK_RESULTS[player.playerId];
    const points = weekResults && weekResults[weekNumber - 1] != null ? weekResults[weekNumber - 1] : 0;
    const grossScores = DEMO_GROSS_SCORES[String(weekNumber)];
    const score = grossScores ? grossScores[idx] : 80 + idx * 2;
    return { ...player, points, score };
  });

  // Sort by points descending
  results.sort((a, b) => b.points - a.points);

  // Assign ranks
  return results.map((r, i) => ({ ...r, rank: i + 1 }));
}

export default function WeekDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{
    season_id: string;
    week_number: string;
    format?: string;
    is_major?: string;
    major_name?: string;
    multiplier?: string;
    date_range?: string;
  }>();

  const weekNumber = parseInt(params.week_number ?? '1', 10);
  const format = params.format ?? 'stableford';
  const isMajor = params.is_major === '1';
  const majorName = params.major_name ?? null;
  const multiplier = parseInt(params.multiplier ?? '1', 10);
  const dateRange = params.date_range ?? null;

  const results = getWeekResults(weekNumber);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={greenHeaderGradient as unknown as string[]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: GEO }]}>
            Week {weekNumber} — {FORMAT_LABELS[format] ?? format}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Major badge */}
        {isMajor && majorName && (
          <View style={styles.majorRow}>
            <View style={[styles.majorBadge, { backgroundColor: '#C9A22733' }]}>
              <Ionicons name="trophy" size={12} color="#C9A227" />
              <Text style={[styles.majorBadgeText, { color: '#C9A227', fontFamily: GEO }]}>MAJOR</Text>
            </View>
            <Text style={[styles.majorName, { color: '#C9A227', fontFamily: GEO }]}>{majorName}</Text>
          </View>
        )}

        {/* Multiplier badge */}
        {multiplier > 1 && (
          <View style={styles.multiplierRow}>
            <View style={[styles.multiplierBadge, { backgroundColor: '#C9A22722' }]}>
              <Ionicons name="star" size={12} color="#C9A227" />
              <Text style={[styles.multiplierText, { color: '#C9A227', fontFamily: GEO }]}>
                {multiplier}× Points
              </Text>
            </View>
          </View>
        )}

        {/* Date range */}
        {dateRange && (
          <Text style={styles.dateRange}>{dateRange}</Text>
        )}
      </LinearGradient>
      <GoldDivider />

      {/* Results table */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Table header */}
        <View style={[styles.tableHeader, { backgroundColor: theme.isDark ? c.elevated : '#006747' }]}>
          <Text style={[styles.thRank, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>#</Text>
          <Text style={[styles.thPlayer, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>Player</Text>
          <Text style={[styles.thScore, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>Score</Text>
          <Text style={[styles.thPoints, { color: theme.isDark ? c.gold : '#FFFFFF', fontFamily: GEO }]}>PTS</Text>
        </View>

        {results.map((r, i) => {
          const isWinner = i === 0;
          return (
            <View
              key={r.playerId}
              style={[
                styles.resultRow,
                {
                  borderBottomColor: c.border,
                  backgroundColor: theme.isDark ? undefined : (i % 2 === 0 ? '#FFFFFF' : '#F8F7F5'),
                },
              ]}
            >
              <Text
                style={[
                  styles.rrRank,
                  {
                    color: isWinner ? c.gold : i < 3 ? c.teal : c.textMuted,
                    fontFamily: GEO,
                  },
                ]}
              >
                {r.rank}
              </Text>

              <View style={styles.rrPlayer}>
                <Avatar id={r.playerId} name={r.name} size={28} />
                <Text
                  style={[
                    styles.rrName,
                    { color: isWinner ? '#C9A227' : c.text },
                  ]}
                  numberOfLines={1}
                >
                  {r.name}
                </Text>
              </View>

              <Text style={[styles.rrScore, { color: c.textMuted, fontFamily: GEO }]}>
                {r.score}
              </Text>

              <Text style={[styles.rrPoints, { color: c.gold, fontFamily: GEO }]}>
                {r.points}
              </Text>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: STATUS_BAR_H + 8, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center' },

  majorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'center' },
  majorBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  majorBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  majorName: { fontSize: 16, fontWeight: '700' },

  multiplierRow: { marginTop: 8, alignItems: 'center' },
  multiplierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4 },
  multiplierText: { fontSize: 13, fontWeight: '700' },

  dateRange: { textAlign: 'center', fontSize: 12, color: '#FFFFFF99', marginTop: 6 },

  body: { flex: 1 },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  thRank: { width: 32, fontSize: 11, fontWeight: '600' },
  thPlayer: { flex: 1, fontSize: 11, fontWeight: '600' },
  thScore: { width: 50, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  thPoints: { width: 50, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rrRank: { width: 32, fontSize: 16, fontWeight: '700' },
  rrPlayer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rrName: { fontSize: 14, fontWeight: '600' },
  rrScore: { width: 50, fontSize: 14, textAlign: 'center' },
  rrPoints: { width: 50, fontSize: 16, fontWeight: '700', textAlign: 'right' },
});
