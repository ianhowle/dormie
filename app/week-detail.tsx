import { useState } from 'react';
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

const FORMAT_EXPLANATIONS: Record<string, string> = {
  stableford: 'Points awarded per hole based on score relative to par. Double bogey+ = 0, Bogey = 1, Par = 2, Birdie = 3, Eagle = 4, Albatross = 5.',
  modified_stableford: 'Like Stableford but rewards aggressive play. Double bogey+ = -3, Bogey = -1, Par = 0, Birdie = +2, Eagle = +5, Albatross = +8.',
  stroke_net: 'Total strokes minus handicap strokes. Lowest net score wins. Handicap strokes allocated by hole difficulty.',
  quota: 'Each player has a quota based on handicap (36 minus handicap). Stableford points earned above quota are your score.',
  best9: 'Only your best 9-hole score counts. Pick front or back nine — whichever is better after handicap adjustment.',
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

// Gross scores for display (fabricated per-week demo data)
const DEMO_GROSS_SCORES: Record<string, number[]> = {
  '1': [74, 78, 76, 80, 82, 84, 86, 90],
  '2': [76, 74, 80, 78, 84, 82, 88, 86],
  '3': [78, 80, 74, 82, 76, 86, 84, 90],
  '4': [80, 78, 82, 90, 84, 86, 88, 92],
};

// Demo course par for to-par calculation
const COURSE_PAR = 72;

// Previous week positions for delta calculation
const DEMO_PREV_POSITIONS: Record<string, Record<number, number>> = {
  '1': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
  '2': { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 },
  '3': { 1: 1, 2: 2, 3: 3, 4: 5, 5: 4, 6: 6, 7: 7, 8: 8 },
  '4': { 1: 1, 2: 3, 3: 2, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 },
};

// Demo highlights per week
const DEMO_HIGHLIGHTS: Record<number, { roundHighlight: string; mostBirdies: string; biggestComeback: string }> = {
  1: {
    roundHighlight: 'McGowan — eagle on the par 5 7th to take the outright lead',
    mostBirdies: 'McGowan (5 birdies)',
    biggestComeback: 'Patterson (+3 positions)',
  },
  2: {
    roundHighlight: 'Fletcher — 3 consecutive birdies on holes 10-12 to surge past McGowan',
    mostBirdies: 'Fletcher (6 birdies)',
    biggestComeback: 'Sullivan (+2 positions)',
  },
  3: {
    roundHighlight: 'Patterson — came back from 5 over through 9 to finish +1',
    mostBirdies: 'Patterson (4 birdies)',
    biggestComeback: 'Rodriguez (+3 positions)',
  },
  4: {
    roundHighlight: 'Fletcher — birdie-birdie-birdie stretch on holes 4-6 to lock up 1st',
    mostBirdies: 'Fletcher (4 birdies)',
    biggestComeback: 'Chen (+2 positions)',
  },
};

// Demo season impact after each week
const DEMO_IMPACT: Record<number, string> = {
  1: 'After this week: McGowan leads by 5 pts, Patterson sits 2nd',
  2: 'After this week: McGowan leads by 3 pts, Fletcher closes the gap',
  3: 'After this week: McGowan leads by 8 pts, Patterson moves to 3rd',
  4: 'After this week: McGowan leads by 8 pts, Sullivan falls to 4th',
};

function getWeekResults(weekNumber: number) {
  const results = DEMO_PLAYERS.map((player, idx) => {
    const weekResults = DEMO_WEEK_RESULTS[player.playerId];
    const points = weekResults && weekResults[weekNumber - 1] != null ? weekResults[weekNumber - 1] : 0;
    const grossScores = DEMO_GROSS_SCORES[String(weekNumber)];
    const score = grossScores ? grossScores[idx] : 80 + idx * 2;
    const toPar = score - COURSE_PAR;
    const prevPos = DEMO_PREV_POSITIONS[String(weekNumber)]?.[idx + 1] ?? 0;
    return { ...player, points, score, toPar, prevPos };
  });

  // Sort by points descending
  results.sort((a, b) => b.points - a.points);

  // Assign ranks and compute delta
  return results.map((r, i) => {
    const rank = i + 1;
    let delta = 0;
    if (r.prevPos > 0) {
      delta = r.prevPos - rank; // positive = improved
    }
    return { ...r, rank, delta };
  });
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
  const highlights = DEMO_HIGHLIGHTS[weekNumber] ?? DEMO_HIGHLIGHTS[1];
  const impact = DEMO_IMPACT[weekNumber] ?? DEMO_IMPACT[1];
  const formatExplanation = FORMAT_EXPLANATIONS[format] ?? null;

  const [formatExpanded, setFormatExpanded] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={greenHeaderGradient as unknown as string[]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { fontFamily: GEO }]}>
              Week {weekNumber}
            </Text>
            <Text style={styles.headerSubtitle}>
              {FORMAT_LABELS[format] ?? format}
            </Text>
          </View>
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

      {/* Body */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* Format Explanation */}
        {formatExplanation && (
          <Pressable
            onPress={() => { haptics.light(); setFormatExpanded(!formatExpanded); }}
            style={[styles.formatCard, { backgroundColor: theme.isDark ? c.elevated : '#F5F1EB', borderColor: c.border }]}
          >
            <View style={styles.formatCardHeader}>
              <Ionicons name="information-circle-outline" size={18} color={c.teal} />
              <Text style={[styles.formatCardTitle, { color: c.teal }]}>Format Explanation</Text>
              <Ionicons name={formatExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.textMuted} />
            </View>
            {formatExpanded && (
              <Text style={[styles.formatCardBody, { color: c.textMuted }]}>
                {formatExplanation}
              </Text>
            )}
          </Pressable>
        )}

        {/* Table header */}
        <View style={[styles.tableHeader, { backgroundColor: theme.isDark ? c.elevated : '#006747' }]}>
          <Text style={[styles.thRank, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>#</Text>
          <Text style={[styles.thPlayer, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>Player</Text>
          <Text style={[styles.thScore, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>Score</Text>
          <Text style={[styles.thToPar, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>To Par</Text>
          <Text style={[styles.thDelta, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>{'\u0394'}</Text>
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
                  backgroundColor: isWinner
                    ? (theme.isDark ? '#C9A22710' : '#C9A22712')
                    : (theme.isDark ? undefined : (i % 2 === 0 ? '#FFFFFF' : '#F8F7F5')),
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
                <View>
                  <Text
                    style={[
                      styles.rrName,
                      { color: isWinner ? '#C9A227' : c.text },
                    ]}
                    numberOfLines={1}
                  >
                    {r.name}
                  </Text>
                  <Text style={[styles.rrHcp, { color: c.textMuted }]}>{r.handicap} hcp</Text>
                </View>
              </View>

              <Text style={[styles.rrScore, { color: c.textMuted, fontFamily: GEO }]}>
                {r.score}
              </Text>

              <Text
                style={[
                  styles.rrToPar,
                  {
                    color: r.toPar < 0 ? '#006747' : r.toPar > 0 ? '#C41E3A' : c.textMuted,
                    fontFamily: GEO,
                  },
                ]}
              >
                {r.toPar === 0 ? 'E' : (r.toPar > 0 ? `+${r.toPar}` : r.toPar)}
              </Text>

              <Text
                style={[
                  styles.rrDelta,
                  {
                    color: r.delta > 0 ? '#006747' : r.delta < 0 ? '#C41E3A' : c.textMuted,
                    fontFamily: GEO,
                  },
                ]}
              >
                {r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${Math.abs(r.delta)}` : '—'}
              </Text>

              <Text style={[styles.rrPoints, { color: c.gold, fontFamily: GEO }]}>
                {r.points}
              </Text>
            </View>
          );
        })}

        {/* Week Highlights */}
        <View style={[styles.highlightsCard, { backgroundColor: theme.isDark ? c.elevated : '#F5F1EB' }]}>
          <Text style={[styles.highlightsTitle, { color: c.gold, fontFamily: GEO }]}>WEEK HIGHLIGHTS</Text>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightEmoji}>{'🦅'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.highlightLabel, { color: c.textMuted }]}>Round Highlight</Text>
              <Text style={[styles.highlightValue, { color: c.text }]}>{highlights.roundHighlight}</Text>
            </View>
          </View>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightEmoji}>{'🐦'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.highlightLabel, { color: c.textMuted }]}>Most Birdies</Text>
              <Text style={[styles.highlightValue, { color: c.text }]}>{highlights.mostBirdies}</Text>
            </View>
          </View>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightEmoji}>{'🔄'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.highlightLabel, { color: c.textMuted }]}>Biggest Comeback</Text>
              <Text style={[styles.highlightValue, { color: c.text }]}>{highlights.biggestComeback}</Text>
            </View>
          </View>
        </View>

        {/* Season Impact */}
        <View style={[styles.impactCard, { backgroundColor: theme.isDark ? c.elevated : '#FFFFFF', borderColor: c.gold + '33' }]}>
          <Ionicons name="trending-up" size={18} color={c.gold} />
          <Text style={[styles.impactTitle, { color: c.gold, fontFamily: GEO }]}>SEASON IMPACT</Text>
          <Text style={[styles.impactText, { color: c.text }]}>{impact}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: STATUS_BAR_H + 8, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#FFFFFF99', marginTop: 2 },

  majorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'center' },
  majorBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  majorBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  majorName: { fontSize: 16, fontWeight: '700' },

  multiplierRow: { marginTop: 8, alignItems: 'center' },
  multiplierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4 },
  multiplierText: { fontSize: 13, fontWeight: '700' },

  dateRange: { textAlign: 'center', fontSize: 12, color: '#FFFFFF99', marginTop: 6 },

  body: { flex: 1 },

  // Format explanation card
  formatCard: { marginHorizontal: 16, marginTop: 16, padding: 14, borderWidth: 1 },
  formatCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formatCardTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  formatCardBody: { fontSize: 13, lineHeight: 19, marginTop: 10 },

  // Table
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 16 },
  thRank: { width: 28, fontSize: 11, fontWeight: '600' },
  thPlayer: { flex: 1, fontSize: 11, fontWeight: '600' },
  thScore: { width: 44, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  thToPar: { width: 44, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  thDelta: { width: 32, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  thPoints: { width: 44, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rrRank: { width: 28, fontSize: 16, fontWeight: '700' },
  rrPlayer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rrName: { fontSize: 14, fontWeight: '600' },
  rrHcp: { fontSize: 10, marginTop: 1 },
  rrScore: { width: 44, fontSize: 14, textAlign: 'center' },
  rrToPar: { width: 44, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  rrDelta: { width: 32, fontSize: 12, textAlign: 'center' },
  rrPoints: { width: 44, fontSize: 16, fontWeight: '700', textAlign: 'right' },

  // Highlights
  highlightsCard: { marginHorizontal: 16, marginTop: 20, padding: 16 },
  highlightsTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  highlightEmoji: { fontSize: 18, width: 26 },
  highlightLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' as const },
  highlightValue: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  // Season Impact
  impactCard: { marginHorizontal: 16, marginTop: 12, padding: 14, borderWidth: 1 },
  impactTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 6, marginBottom: 6 },
  impactText: { fontSize: 14, lineHeight: 20 },
});
