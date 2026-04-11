import { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { DonutChart, DonutLegend } from './DonutChart';
import type { DonutSegment } from './DonutChart';
import { STAT_COLORS, MOCK_PLAYER_AVERAGES } from '../data/playerStats';
import type { HoleResult } from './PostRoundSummary';
import GoldDivider from './GoldDivider';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────
type RoundStatsCardProps = {
  holes: HoleResult[];
  /** Player's career averages for comparison */
  averages?: {
    birdiesPerRound: number;
    parsPerRound: number;
    bogeysPerRound: number;
    girPct: number;
    firPct: number;
    puttsPerRound: number;
  };
};

// ─── Comparison badge ────────────────────────────────────────────────
function ComparisonBadge({ value, label, suffix }: { value: number; label: string; suffix?: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const color = isNeutral ? c.textMuted : isPositive ? c.teal : c.urgent;
  const arrow = isPositive ? '\u2191' : '\u2193';

  return (
    <Text style={[styles.comparisonText, { color }]}>
      {isNeutral ? '=' : arrow} vs your avg {Math.abs(value).toFixed(value % 1 === 0 ? 0 : 1)}{suffix ?? '%'}
    </Text>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export function RoundStatsCard({ holes, averages = MOCK_PLAYER_AVERAGES }: RoundStatsCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Calculate this round's scoring breakdown
  const counts = useMemo(() => {
    const result = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0 };
    holes.forEach((h) => {
      const diff = h.gross - h.par;
      if (diff <= -2) result.eagles++;
      else if (diff === -1) result.birdies++;
      else if (diff === 0) result.pars++;
      else if (diff === 1) result.bogeys++;
      else result.doubles++;
    });
    return result;
  }, [holes]);

  // GIR/FIR stats
  const girCount = holes.filter((h) => h.gir).length;
  const girTotal = holes.length;
  const girPct = girTotal > 0 ? Math.round((girCount / girTotal) * 100) : 0;

  const fairwayHoles = holes.filter((h) => h.fir !== null);
  const firCount = fairwayHoles.filter((h) => h.fir).length;
  const firTotal = fairwayHoles.length;
  const firPct = firTotal > 0 ? Math.round((firCount / firTotal) * 100) : 0;

  // Putting stats
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const girHoles = holes.filter((h) => h.gir);
  const puttsPerGir = girHoles.length > 0
    ? (girHoles.reduce((s, h) => s + h.putts, 0) / girHoles.length)
    : 0;
  const threePutts = holes.filter((h) => h.putts >= 3).length;

  // Comparison deltas
  const birdiesDelta = counts.birdies - averages.birdiesPerRound;
  const girDelta = girPct - averages.girPct;
  const firDelta = firPct - averages.firPct;

  const segments: DonutSegment[] = [
    { label: 'Eagles', value: counts.eagles, color: STAT_COLORS.eagle },
    { label: 'Birdies', value: counts.birdies, color: STAT_COLORS.birdie },
    { label: 'Pars', value: counts.pars, color: STAT_COLORS.par },
    { label: 'Bogeys', value: counts.bogeys, color: STAT_COLORS.bogey },
    { label: 'Double+', value: counts.doubles, color: STAT_COLORS.double },
  ];

  return (
    <View style={styles.container}>
      {/* ─── Scoring Breakdown ─────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: c.gold }]}>ROUND STATISTICS</Text>

      <View style={styles.scoringRow}>
        <DonutChart
          segments={segments}
          size={110}
          strokeWidth={16}
          centerValue={String(holes.length)}
          centerLabel="holes"
        />
        <View style={styles.scoringSummary}>
          {segments.filter(s => s.value > 0).map((seg) => (
            <View key={seg.label} style={styles.scoringLine}>
              <View style={[styles.scoringDot, { backgroundColor: seg.color }]} />
              <Text style={[styles.scoringCount, { color: c.text, fontFamily: GEO }]}>
                {seg.value}
              </Text>
              <Text style={[styles.scoringLabel, { color: c.textMuted }]}>{seg.label}</Text>
            </View>
          ))}
          {birdiesDelta !== 0 && (
            <Text style={[styles.comparisonNote, { color: birdiesDelta > 0 ? c.teal : c.urgent }]}>
              {birdiesDelta > 0 ? '+' : ''}{birdiesDelta.toFixed(1)} birdies vs avg round
            </Text>
          )}
        </View>
      </View>

      <GoldDivider style={{ marginVertical: 12 }} />

      {/* ─── Greens & Fairways ─────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: c.gold }]}>GREENS & FAIRWAYS</Text>

      <View style={styles.statBoxRow}>
        {/* GIR box */}
        <View style={[styles.statBox, { backgroundColor: c.elevated }]}>
          <Text style={[styles.statBoxLabel, { color: c.textMuted }]}>GIR</Text>
          <Text style={[styles.statBoxValue, { color: c.text, fontFamily: GEO }]}>
            {girCount}/{girTotal}
          </Text>
          <Text style={[styles.statBoxPct, { color: STAT_COLORS.player, fontFamily: GEO }]}>
            {girPct}%
          </Text>
          <ComparisonBadge value={girDelta} label="GIR" />
        </View>

        {/* FIR box */}
        <View style={[styles.statBox, { backgroundColor: c.elevated }]}>
          <Text style={[styles.statBoxLabel, { color: c.textMuted }]}>FIR</Text>
          <Text style={[styles.statBoxValue, { color: c.text, fontFamily: GEO }]}>
            {firCount}/{firTotal}
          </Text>
          <Text style={[styles.statBoxPct, { color: STAT_COLORS.player, fontFamily: GEO }]}>
            {firPct}%
          </Text>
          <ComparisonBadge value={firDelta} label="FIR" />
        </View>
      </View>

      <GoldDivider style={{ marginVertical: 12 }} />

      {/* ─── Putting ───────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: c.gold }]}>PUTTING</Text>

      <View style={styles.puttingGrid}>
        <View style={styles.puttingStat}>
          <Text style={[styles.puttingValue, { color: c.text, fontFamily: GEO }]}>
            {totalPutts}
          </Text>
          <Text style={[styles.puttingLabel, { color: c.textMuted }]}>Total Putts</Text>
        </View>
        <View style={styles.puttingStat}>
          <Text style={[styles.puttingValue, { color: c.text, fontFamily: GEO }]}>
            {puttsPerGir > 0 ? puttsPerGir.toFixed(1) : '\u2014'}
          </Text>
          <Text style={[styles.puttingLabel, { color: c.textMuted }]}>Putts/GIR</Text>
        </View>
        <View style={styles.puttingStat}>
          <Text style={[styles.puttingValue, { color: threePutts > 0 ? c.urgent : c.teal, fontFamily: GEO }]}>
            {threePutts}
          </Text>
          <Text style={[styles.puttingLabel, { color: c.textMuted }]}>3-Putts</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scoringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoringSummary: {
    flex: 1,
    gap: 4,
  },
  scoringLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoringDot: {
    width: 8,
    height: 8,
  },
  scoringCount: {
    fontSize: 16,
    fontWeight: '700',
    width: 22,
  },
  scoringLabel: {
    fontSize: 11,
  },
  comparisonNote: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  comparisonText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  statBoxRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 2,
  },
  statBoxLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statBoxPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  puttingGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  puttingStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  puttingValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
  },
  puttingLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
