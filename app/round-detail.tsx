import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Mock hole-by-hole data ──────────────────────────────────────────
const MOCK_PARS = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4];
const MOCK_SCORES = [4, 5, 3, 4, 4, 2, 5, 5, 3, 4, 3, 6, 4, 5, 3, 5, 4, 4];

const MOCK_STATS = {
  totalPutts: 30,
  onePutts: 5,
  threePutts: 2,
  firPct: 64,
  girPct: 56,
  scramblePct: 45,
};

const MOCK_PUTT_DISTANCES = [
  { label: 'Inside 5ft', made: 12, total: 14, pct: 86 },
  { label: '5-15ft', made: 4, total: 10, pct: 40 },
  { label: '15-30ft', made: 1, total: 5, pct: 20 },
  { label: '30ft+', made: 0, total: 3, pct: 0 },
];

function scoreColorForCell(score: number, par: number, colors: any): string {
  const diff = score - par;
  if (diff <= -2) return colors.gold;       // Eagle or better
  if (diff === -1) return colors.teal;      // Birdie
  if (diff === 0) return colors.text;       // Par
  if (diff === 1) return colors.urgent;     // Bogey
  return '#C41E3A';                         // Double+
}

function scoreBgForCell(score: number, par: number): string {
  const diff = score - par;
  if (diff <= -2) return '#C9A22718';
  if (diff === -1) return '#00674718';
  if (diff === 0) return 'transparent';
  if (diff === 1) return '#C41E3A12';
  return '#C41E3A20';
}

export default function RoundDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{
    roundId: string;
    course: string;
    score: string;
    par: string;
    date: string;
    source: string;
  }>();

  const score = parseInt(params.score || '0', 10);
  const par = parseInt(params.par || '72', 10);
  const diff = score - par;
  const toParStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;

  // Scoring distribution
  const distribution = useMemo(() => {
    let eagles = 0, birdies = 0, pars = 0, bogeys = 0, doubles = 0;
    MOCK_SCORES.forEach((s, i) => {
      const d = s - MOCK_PARS[i];
      if (d <= -2) eagles++;
      else if (d === -1) birdies++;
      else if (d === 0) pars++;
      else if (d === 1) bogeys++;
      else doubles++;
    });
    return { eagles, birdies, pars, bogeys, doubles };
  }, []);

  const totalHoles = 18;
  const distSegments = [
    { label: 'Eagles', count: distribution.eagles, color: '#C9A227' },
    { label: 'Birdies', count: distribution.birdies, color: '#006747' },
    { label: 'Pars', count: distribution.pars, color: c.textMuted },
    { label: 'Bogeys', count: distribution.bogeys, color: '#C41E3A' },
    { label: 'Doubles+', count: distribution.doubles, color: '#7A2E30' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* ─── HEADER ──────────────────────────────────────────────── */}
        <LinearGradient colors={['#1E4D2B', '#2D6A3F']} style={styles.header}>
          <View style={styles.headerNav}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerScore}>{score}</Text>
            <Text style={styles.headerToPar}>{toParStr}</Text>
            <Text style={styles.headerCourse} numberOfLines={1}>{params.course ?? 'Unknown Course'}</Text>
            <Text style={styles.headerDate}>{params.date ?? ''}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* ─── HOLE-BY-HOLE SCORECARD ────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.gold, fontFamily: GEO }]}>SCORECARD</Text>

          {/* Front 9 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scorecardScroll}>
            <View>
              {/* Hole numbers */}
              <View style={styles.scorecardRow}>
                <View style={[styles.scorecardLabel, { backgroundColor: c.elevated }]}>
                  <Text style={[styles.scorecardLabelText, { color: c.textMuted }]}>HOLE</Text>
                </View>
                {MOCK_PARS.slice(0, 9).map((_, i) => (
                  <View key={i} style={[styles.scorecardCell, { backgroundColor: c.elevated }]}>
                    <Text style={[styles.scorecardCellText, { color: c.textMuted, fontFamily: GEO }]}>{i + 1}</Text>
                  </View>
                ))}
                <View style={[styles.scorecardCell, { backgroundColor: c.elevated }]}>
                  <Text style={[styles.scorecardCellText, { color: c.textMuted, fontFamily: GEO }]}>OUT</Text>
                </View>
              </View>
              {/* Par row */}
              <View style={styles.scorecardRow}>
                <View style={[styles.scorecardLabel, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.scorecardLabelText, { color: c.textMuted }]}>PAR</Text>
                </View>
                {MOCK_PARS.slice(0, 9).map((p, i) => (
                  <View key={i} style={[styles.scorecardCell, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                    <Text style={[styles.scorecardCellText, { color: c.textMuted, fontFamily: GEO }]}>{p}</Text>
                  </View>
                ))}
                <View style={[styles.scorecardCell, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.scorecardCellText, { color: c.textMuted, fontFamily: GEO }]}>{MOCK_PARS.slice(0, 9).reduce((a, b) => a + b, 0)}</Text>
                </View>
              </View>
              {/* Score row */}
              <View style={styles.scorecardRow}>
                <View style={[styles.scorecardLabel, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.scorecardLabelText, { color: c.text }]}>SCORE</Text>
                </View>
                {MOCK_SCORES.slice(0, 9).map((s, i) => (
                  <View key={i} style={[styles.scorecardCell, { backgroundColor: scoreBgForCell(s, MOCK_PARS[i]), borderColor: c.border, borderWidth: 1 }]}>
                    <Text style={[styles.scorecardCellText, { color: scoreColorForCell(s, MOCK_PARS[i], c), fontFamily: GEO, fontWeight: '700' }]}>{s}</Text>
                  </View>
                ))}
                <View style={[styles.scorecardCell, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.scorecardCellText, { color: c.text, fontFamily: GEO, fontWeight: '700' }]}>{MOCK_SCORES.slice(0, 9).reduce((a, b) => a + b, 0)}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Back 9 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.scorecardScroll, { marginTop: 4 }]}>
            <View>
              <View style={styles.scorecardRow}>
                <View style={[styles.scorecardLabel, { backgroundColor: c.elevated }]}>
                  <Text style={[styles.scorecardLabelText, { color: c.textMuted }]}>HOLE</Text>
                </View>
                {MOCK_PARS.slice(9).map((_, i) => (
                  <View key={i} style={[styles.scorecardCell, { backgroundColor: c.elevated }]}>
                    <Text style={[styles.scorecardCellText, { color: c.textMuted, fontFamily: GEO }]}>{i + 10}</Text>
                  </View>
                ))}
                <View style={[styles.scorecardCell, { backgroundColor: c.elevated }]}>
                  <Text style={[styles.scorecardCellText, { color: c.textMuted, fontFamily: GEO }]}>IN</Text>
                </View>
              </View>
              <View style={styles.scorecardRow}>
                <View style={[styles.scorecardLabel, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.scorecardLabelText, { color: c.textMuted }]}>PAR</Text>
                </View>
                {MOCK_PARS.slice(9).map((p, i) => (
                  <View key={i} style={[styles.scorecardCell, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                    <Text style={[styles.scorecardCellText, { color: c.textMuted, fontFamily: GEO }]}>{p}</Text>
                  </View>
                ))}
                <View style={[styles.scorecardCell, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.scorecardCellText, { color: c.textMuted, fontFamily: GEO }]}>{MOCK_PARS.slice(9).reduce((a, b) => a + b, 0)}</Text>
                </View>
              </View>
              <View style={styles.scorecardRow}>
                <View style={[styles.scorecardLabel, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.scorecardLabelText, { color: c.text }]}>SCORE</Text>
                </View>
                {MOCK_SCORES.slice(9).map((s, i) => (
                  <View key={i} style={[styles.scorecardCell, { backgroundColor: scoreBgForCell(s, MOCK_PARS[i + 9]), borderColor: c.border, borderWidth: 1 }]}>
                    <Text style={[styles.scorecardCellText, { color: scoreColorForCell(s, MOCK_PARS[i + 9], c), fontFamily: GEO, fontWeight: '700' }]}>{s}</Text>
                  </View>
                ))}
                <View style={[styles.scorecardCell, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.scorecardCellText, { color: c.text, fontFamily: GEO, fontWeight: '700' }]}>{MOCK_SCORES.slice(9).reduce((a, b) => a + b, 0)}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* ─── STATS GRID ────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.gold, fontFamily: GEO, marginTop: 24 }]}>ROUND STATS</Text>
          <View style={styles.statsGrid}>
            {[
              { label: 'Total Putts', value: String(MOCK_STATS.totalPutts) },
              { label: '1-Putts', value: String(MOCK_STATS.onePutts) },
              { label: '3-Putts', value: String(MOCK_STATS.threePutts) },
              { label: 'FIR%', value: `${MOCK_STATS.firPct}%` },
              { label: 'GIR%', value: `${MOCK_STATS.girPct}%` },
              { label: 'Scramble%', value: `${MOCK_STATS.scramblePct}%` },
            ].map((stat) => (
              <View key={stat.label} style={[styles.statCell, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                <Text style={[styles.statValue, { color: c.teal, fontFamily: GEO }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: c.textMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* ─── SCORING DISTRIBUTION ──────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.gold, fontFamily: GEO, marginTop: 24 }]}>SCORING DISTRIBUTION</Text>
          <View style={[styles.distCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={styles.distBar}>
              {distSegments.filter(s => s.count > 0).map((seg) => (
                <View
                  key={seg.label}
                  style={[styles.distSegment, { backgroundColor: seg.color, flex: seg.count }]}
                />
              ))}
            </View>
            <View style={styles.distLegend}>
              {distSegments.map((seg) => (
                <View key={seg.label} style={styles.distLegendItem}>
                  <View style={[styles.distDot, { backgroundColor: seg.color }]} />
                  <Text style={[styles.distLegendText, { color: c.textMuted }]}>{seg.label}</Text>
                  <Text style={[styles.distLegendCount, { color: c.text, fontFamily: GEO }]}>{seg.count}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ─── PUTT DISTANCE BREAKDOWN ───────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.gold, fontFamily: GEO, marginTop: 24 }]}>PUTT DISTANCE BREAKDOWN</Text>
          <View style={[styles.puttCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            {MOCK_PUTT_DISTANCES.map((row) => (
              <View key={row.label} style={styles.puttRow}>
                <Text style={[styles.puttLabel, { color: c.text }]}>{row.label}</Text>
                <View style={[styles.puttBarBg, { backgroundColor: c.elevated }]}>
                  <View style={[styles.puttBarFill, { backgroundColor: c.teal, width: `${row.pct}%` }]} />
                </View>
                <Text style={[styles.puttPct, { color: c.teal, fontFamily: GEO }]}>{row.pct}%</Text>
                <Text style={[styles.puttFraction, { color: c.textMuted }]}>{row.made}/{row.total}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H + 8,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerNav: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerScore: {
    fontSize: 56,
    fontWeight: '800',
    color: '#C9A227',
    fontFamily: GEO,
  },
  headerToPar: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFFCC',
    fontFamily: GEO,
    marginTop: -4,
  },
  headerCourse: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  headerDate: {
    fontSize: 13,
    color: '#FFFFFF88',
    marginTop: 4,
  },

  /* Body */
  body: { paddingHorizontal: 16, paddingTop: 8 },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 10,
  },

  /* Scorecard */
  scorecardScroll: { marginBottom: 0 },
  scorecardRow: { flexDirection: 'row' },
  scorecardLabel: {
    width: 50,
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorecardLabelText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scorecardCell: {
    width: 36,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorecardCellText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Stats grid */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCell: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },

  /* Scoring distribution */
  distCard: {
    borderWidth: 1,
    padding: 14,
  },
  distBar: {
    flexDirection: 'row',
    height: 16,
    overflow: 'hidden',
    gap: 2,
  },
  distSegment: {
    height: '100%',
  },
  distLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  distLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distDot: {
    width: 8,
    height: 8,
  },
  distLegendText: {
    fontSize: 11,
  },
  distLegendCount: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Putt distance */
  puttCard: {
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  puttRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  puttLabel: {
    width: 70,
    fontSize: 12,
    fontWeight: '600',
  },
  puttBarBg: {
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  puttBarFill: {
    height: '100%',
  },
  puttPct: {
    width: 36,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  puttFraction: {
    width: 30,
    fontSize: 11,
    textAlign: 'right',
  },
});
