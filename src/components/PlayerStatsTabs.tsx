import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { haptics } from '../lib/haptics';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import {
  DonutChart,
  DonutLegend,
  NestedDonutChart,
  MiniProgressCircle,
} from './DonutChart';
import type { DonutSegment } from './DonutChart';
import {
  STAT_COLORS,
  type PlayerStats,
  type PerRoundStat,
} from '../data/playerStats';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Tab definitions ─────────────────────────────────────────────────
const TABS = ['Scoring', 'Greens', 'Fairways', 'Putting'] as const;
type TabKey = (typeof TABS)[number];

// ─── Props ───────────────────────────────────────────────────────────
type Props = {
  stats: PlayerStats;
};

// ─── Trend Indicator ─────────────────────────────────────────────────
function TrendIndicator({ value, suffix, invert }: { value: number; suffix?: string; invert?: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  // For putting, negative is good (fewer putts)
  const isPositive = invert ? value < 0 : value > 0;
  const isNeutral = value === 0;
  const displayVal = Math.abs(value);
  const arrow = isPositive ? '\u2191' : '\u2193';
  const color = isNeutral ? c.textMuted : isPositive ? c.teal : c.urgent;

  return (
    <View style={styles.trendRow}>
      <Text style={[styles.trendText, { color }]}>
        {arrow} {displayVal.toFixed(value % 1 === 0 ? 0 : 1)}{suffix ?? '%'} vs your average
      </Text>
    </View>
  );
}

// ─── Per-Round Progression ───────────────────────────────────────────
function RoundProgression({ rounds, color }: { rounds: PerRoundStat[]; color?: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.progressionRow}
    >
      {rounds.map((r) => (
        <MiniProgressCircle
          key={r.roundId}
          percentage={r.percentage}
          label={r.label}
          color={color}
        />
      ))}
    </ScrollView>
  );
}

// ─── Tab: Scoring Summary ────────────────────────────────────────────
function ScoringTab({ stats }: { stats: PlayerStats }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { scoring } = stats;
  const total = scoring.eagles + scoring.birdies + scoring.pars + scoring.bogeys + scoring.doubles;

  const segments: DonutSegment[] = [
    { label: 'Eagles', value: scoring.eagles, color: STAT_COLORS.eagle },
    { label: 'Birdies', value: scoring.birdies, color: STAT_COLORS.birdie },
    { label: 'Pars', value: scoring.pars, color: STAT_COLORS.par },
    { label: 'Bogeys', value: scoring.bogeys, color: STAT_COLORS.bogey },
    { label: 'Double+', value: scoring.doubles, color: STAT_COLORS.double },
  ];

  return (
    <View style={styles.tabContent}>
      <DonutChart
        segments={segments}
        size={170}
        strokeWidth={22}
        centerValue={String(total)}
        centerLabel="holes"
      />
      <DonutLegend segments={segments} />
      <Text style={[styles.helperText, { color: c.textMuted }]}>
        Based on {scoring.totalRounds} rounds
      </Text>
    </View>
  );
}

// ─── Tab: Greens Hit ─────────────────────────────────────────────────
function GreensTab({ stats }: { stats: PlayerStats }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { greens } = stats;

  return (
    <View style={styles.tabContent}>
      <NestedDonutChart
        playerPct={greens.playerPct}
        groupPct={greens.groupAvgPct}
        size={150}
        label="group avg"
      />
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STAT_COLORS.player }]} />
          <Text style={[styles.legendLabel, { color: c.textMuted }]}>You ({greens.playerPct}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STAT_COLORS.group }]} />
          <Text style={[styles.legendLabel, { color: c.textMuted }]}>Group ({greens.groupAvgPct}%)</Text>
        </View>
      </View>
      <TrendIndicator value={greens.trendPct} />
      <Text style={[styles.sectionSubhead, { color: c.textMuted }]}>Recent Rounds</Text>
      <RoundProgression rounds={greens.perRound} color={STAT_COLORS.player} />
    </View>
  );
}

// ─── Tab: Fairways Hit ───────────────────────────────────────────────
function FairwaysTab({ stats }: { stats: PlayerStats }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { fairways } = stats;

  return (
    <View style={styles.tabContent}>
      <NestedDonutChart
        playerPct={fairways.playerPct}
        groupPct={fairways.groupAvgPct}
        size={150}
        label="group avg"
      />
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STAT_COLORS.player }]} />
          <Text style={[styles.legendLabel, { color: c.textMuted }]}>You ({fairways.playerPct}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STAT_COLORS.group }]} />
          <Text style={[styles.legendLabel, { color: c.textMuted }]}>Group ({fairways.groupAvgPct}%)</Text>
        </View>
      </View>
      <Text style={[styles.helperText, { color: c.textMuted }]}>
        Fairways hit on par 4s and 5s
      </Text>
      <TrendIndicator value={fairways.trendPct} />
      <Text style={[styles.sectionSubhead, { color: c.textMuted }]}>Recent Rounds</Text>
      <RoundProgression rounds={fairways.perRound} color={STAT_COLORS.player} />
    </View>
  );
}

// ─── Tab: Putting ────────────────────────────────────────────────────
function PuttingTab({ stats }: { stats: PlayerStats }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { putting } = stats;

  // Convert putts per GIR to a percentage for nested donut (lower is better)
  // 1.0 putts/GIR = 100%, 2.0 = 50%, etc. Invert for display
  const playerPuttPct = Math.round((1 / putting.puttsPerGir) * 100);
  const groupPuttPct = Math.round((1 / putting.groupPuttsPerGir) * 100);

  return (
    <View style={styles.tabContent}>
      {/* Big number: avg putts */}
      <View style={styles.bigStatRow}>
        <Text style={[styles.bigStatValue, { color: c.text, fontFamily: GEO }]}>
          {putting.avgPuttsPerRound.toFixed(1)}
        </Text>
        <Text style={[styles.bigStatLabel, { color: c.textMuted }]}>avg putts/round</Text>
      </View>

      {/* Putts per GIR comparison */}
      <NestedDonutChart
        playerPct={playerPuttPct}
        groupPct={groupPuttPct}
        size={130}
        label="group"
      />
      <View style={styles.puttDetailRow}>
        <Text style={[styles.puttDetailLabel, { color: c.textMuted }]}>Putts/GIR</Text>
        <Text style={[styles.puttDetailValue, { color: STAT_COLORS.player, fontFamily: GEO }]}>
          {putting.puttsPerGir.toFixed(2)}
        </Text>
        <Text style={[styles.puttDetailVs, { color: c.textMuted }]}>
          vs {putting.groupPuttsPerGir.toFixed(2)} group
        </Text>
      </View>

      {/* 3-putt avoidance & 1-putt conversion */}
      <View style={styles.puttStatsRow}>
        <View style={styles.puttStatBox}>
          <Text style={[styles.puttStatValue, { color: c.teal, fontFamily: GEO }]}>
            {putting.threePuttAvoidancePct}%
          </Text>
          <Text style={[styles.puttStatLabel, { color: c.textMuted }]}>3-Putt Avoidance</Text>
        </View>
        <View style={styles.puttStatBox}>
          <Text style={[styles.puttStatValue, { color: c.teal, fontFamily: GEO }]}>
            {putting.onePuttConversionPct}%
          </Text>
          <Text style={[styles.puttStatLabel, { color: c.textMuted }]}>1-Putt Conversion</Text>
        </View>
      </View>

      <TrendIndicator value={putting.trendPutts} suffix=" putts" invert />
      <Text style={[styles.sectionSubhead, { color: c.textMuted }]}>1-Putt % by Round</Text>
      <RoundProgression rounds={putting.perRound} color={STAT_COLORS.player} />
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export function PlayerStatsTabs({ stats }: Props) {
  const { theme } = useTheme();
  const isDark = theme.isDark;
  const c = theme.colors;
  const [activeTab, setActiveTab] = useState<TabKey>('Scoring');
  const cardShadow = isDark ? cardShadowDark : cardShadowLight;
  const scrollRef = useRef<ScrollView>(null);

  const handleTabPress = useCallback((tab: TabKey, idx: number) => {
    haptics.light();
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ x: idx * SCREEN_W, animated: true });
  }, []);

  const handleScrollEnd = useCallback((e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (page >= 0 && page < TABS.length) {
      setActiveTab(TABS[page]);
    }
  }, []);

  return (
    <View style={[styles.wrapper, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, ...cardShadow }]}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, idx) => {
          const isActive = tab === activeTab;
          return (
            <Pressable
              key={tab}
              onPress={() => handleTabPress(tab, idx)}
              style={[
                styles.tabBtn,
                isActive && { borderBottomColor: c.gold, borderBottomWidth: 2 },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? c.gold : c.textMuted },
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Swipeable content */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        <View style={{ width: SCREEN_W - 42 }}>
          <ScoringTab stats={stats} />
        </View>
        <View style={{ width: SCREEN_W - 42 }}>
          <GreensTab stats={stats} />
        </View>
        <View style={{ width: SCREEN_W - 42 }}>
          <FairwaysTab stats={stats} />
        </View>
        <View style={{ width: SCREEN_W - 42 }}>
          <PuttingTab stats={stats} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pager: {
    flexGrow: 0,
  },
  tabContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 12,
  },
  helperText: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionSubhead: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  progressionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
  },
  legendLabel: {
    fontSize: 11,
  },
  bigStatRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  bigStatValue: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -2,
  },
  bigStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  puttDetailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 8,
  },
  puttDetailLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  puttDetailValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  puttDetailVs: {
    fontSize: 11,
  },
  puttStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    width: '100%',
  },
  puttStatBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  puttStatValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  puttStatLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});
